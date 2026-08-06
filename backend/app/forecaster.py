import datetime
import os
import pickle
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from app.models import EnergyMetric
from sklearn.ensemble import RandomForestRegressor

MODEL_PATH = os.path.join(os.path.dirname(__file__), "energy_model.pkl")

def prepare_training_data(db: Session):
    # Fetch all energy metrics from database
    metrics = db.query(EnergyMetric).order_by(EnergyMetric.timestamp.asc()).all()
    
    # If database has insufficient records, generate a synthetic history of 14 days (336 hours)
    # to train a robust baseline ML model
    if len(metrics) < 48:
        print("[INFO] Database has insufficient metrics history (<48 records). Generating synthetic baseline training dataset...")
        now = datetime.datetime.utcnow()
        synthetic_data = []
        energy_accumulator = 120.0
        
        # 14 days of hourly history
        for i in range(336, 0, -1):
            ts = now - datetime.timedelta(hours=i)
            hour = ts.hour
            day_of_week = ts.weekday()
            
            # Base load profiles (diurnal patterns + weekend variations)
            if 7 <= hour <= 9:
                base_power = 3.5 + (0.5 if day_of_week >= 5 else 0.0) # Morning peak
            elif 18 <= hour <= 22:
                base_power = 4.2 + (0.8 if day_of_week >= 5 else 0.0) # Evening peak
            elif 0 <= hour <= 5:
                base_power = 0.5
            else:
                base_power = 1.4 + (0.4 if day_of_week >= 5 else 0.0)
                
            # Add normal noise
            active_power = max(0.15, base_power + np.random.normal(0, 0.25))
            energy_accumulator += active_power
            
            synthetic_data.append({
                "timestamp": ts,
                "active_power": active_power,
                "voltage": 230.0 + np.random.normal(0, 1.5),
                "current": (active_power * 1000.0) / 230.0,
                "energy_consumed_kwh": energy_accumulator,
                "grid_status": "grid"
            })
            
        df = pd.DataFrame(synthetic_data)
    else:
        # Convert DB query records directly into a pandas DataFrame
        data = [{
            "timestamp": m.timestamp,
            "active_power": m.active_power,
            "energy_consumed_kwh": m.energy_consumed_kwh
        } for m in metrics]
        df = pd.DataFrame(data)

    # Feature Engineering
    df["hour"] = df["timestamp"].dt.hour
    df["dayofweek"] = df["timestamp"].dt.dayofweek
    
    # Create lag features (previous 1 and 2 hours consumption)
    df["lag_1"] = df["active_power"].shift(1)
    df["lag_2"] = df["active_power"].shift(2)
    
    # Drop rows with NaN due to shift
    df = df.dropna()
    
    features = ["hour", "dayofweek", "lag_1", "lag_2"]
    X = df[features]
    y = df["active_power"]
    
    return X, y

def train_energy_model(db: Session):
    print("[INFO] AI Energy Forecaster: Starting model training...")
    try:
        X, y = prepare_training_data(db)
        
        # Train a Random Forest regressor with estimators
        model = RandomForestRegressor(n_estimators=50, random_state=42)
        model.fit(X, y)
        
        # Save model parameters
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(model, f)
            
        print("[SUCCESS] AI Energy Forecaster: Model trained and saved successfully.")
        return True
    except Exception as e:
        print(f"[ERROR] AI Energy Forecaster: Training failed: {e}")
        return False

def predict_next_24h_demand(db: Session) -> list:
    # 1. Load model, if not exists train first
    if not os.path.exists(MODEL_PATH):
        trained = train_energy_model(db)
        if not trained:
            # Fallback mock prediction if model training crashes
            return []

    try:
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
    except Exception as e:
        print(f"[WARNING] Error loading model: {e}. Re-training model...")
        train_energy_model(db)
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)

    # 2. Extract lag values from the most recent database records
    recent_metrics = db.query(EnergyMetric).order_by(EnergyMetric.timestamp.desc()).limit(2).all()
    
    # Defaults if db has no records
    lag_1 = recent_metrics[0].active_power if len(recent_metrics) > 0 else 1.8
    lag_2 = recent_metrics[1].active_power if len(recent_metrics) > 1 else 1.5

    predictions = []
    now = datetime.datetime.utcnow()
    
    # Roll forward hour by hour for the next 24 hours
    current_lag_1 = lag_1
    current_lag_2 = lag_2
    
    for i in range(24):
        future_time = now + datetime.timedelta(hours=i)
        hour = future_time.hour
        dayofweek = future_time.weekday()
        
        # X features vector: [hour, dayofweek, lag_1, lag_2]
        features = np.array([[hour, dayofweek, current_lag_1, current_lag_2]])
        
        # Run prediction
        pred_power = float(model.predict(features)[0])
        
        # Bounds logic (incorporate uncertainty over future steps)
        # Standard margin increases with forecast horizon step
        uncertainty = 0.15 + (i * 0.015) 
        confidence_upper = max(0.1, pred_power + uncertainty)
        confidence_lower = max(0.05, pred_power - uncertainty)

        predictions.append({
            "timestamp": future_time.isoformat() + "Z",
            "hour_label": f"{hour}:00",
            "predicted_kwh": round(pred_power, 3),
            "confidence_upper": round(confidence_upper, 3),
            "confidence_lower": round(confidence_lower, 3)
        })
        
        # Update lags for recursive forecast sequencing
        current_lag_2 = current_lag_1
        current_lag_1 = pred_power

    return predictions

def predict_solar_generation(hour: int, weather_condition: str) -> float:
    # A simple regression curve that maps weather condition indexes to generation multiplier
    weather_multipliers = {
        "Sunny": 1.0,
        "Partly Cloudy": 0.75,
        "Overcast": 0.3,
        "Rainy": 0.15,
        "Clear": 0.0
    }
    
    mult = weather_multipliers.get(weather_condition, 1.0)
    
    if 6 <= hour <= 18:
        # Solar noon bell curve peaking around 12-1 PM
        bell_curve = math_bell(hour, 12, 2.5)
        # Peak production capacity is 5.2 kW
        pred_solar = bell_curve * 5.2 * mult
        return round(max(0.0, pred_solar), 3)
    else:
        return 0.0

def math_bell(x, mean, std_dev):
    import math
    return math.exp(-0.5 * ((x - mean) / std_dev) ** 2)
