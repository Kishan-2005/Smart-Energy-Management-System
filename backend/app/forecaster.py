import os
import pickle
import datetime
HAS_ML = True
try:
    import numpy as np
    import pandas as pd
    HAS_ML = True
except ImportError:
    HAS_ML = False
    print("[FORECASTER] WARNING: ML libraries (numpy/pandas) could not be loaded due to security/policy controls.")
    print("[FORECASTER] Falling back to pure Python rule-based models.")

from sqlalchemy.orm import Session
from app.models import EnergyMetric

# Default path for pickled model parameters
MODEL_PATH = os.path.join(os.path.dirname(__file__), "energy_model.pkl")

# Check for WDAC app blocker on xgboost.dll, fallback to Sklearn Gradient Boosting
HAS_XGBOOST = False
if HAS_ML:
    try:
        import xgboost as xgb
        # Verify instantiation works
        test_model = xgb.XGBRegressor(n_estimators=1)
        HAS_XGBOOST = True
        print("[FORECASTER] XGBoost library imported and verified successfully.")
    except Exception as e:
        print(f"[FORECASTER] WARNING: XGBoost C++ library loading failed: {e}")
        print("[FORECASTER] Falling back to Scikit-Learn GradientBoostingRegressor.")
        try:
            from sklearn.ensemble import GradientBoostingRegressor
        except ImportError:
            HAS_ML = False
            print("[FORECASTER] WARNING: Scikit-Learn could not be loaded. Falling back to pure Python models.")

def prepare_training_data(db: Session):
    # Fetch all energy metrics from database
    metrics = db.query(EnergyMetric).order_by(EnergyMetric.timestamp.asc()).all()
    
    # If database has insufficient records, generate a synthetic history of 14 days (336 hours)
    if len(metrics) < 48:
        print("[FORECASTER] Database has insufficient history. Generating synthetic training dataset...")
        now = datetime.datetime.utcnow()
        synthetic_data = []
        energy_accumulator = 120.0
        
        for i in range(336, 0, -1):
            ts = now - datetime.timedelta(hours=i)
            hour = ts.hour
            day_of_week = ts.weekday()
            
            # Base diurnal patterns
            if 7 <= hour <= 9:
                base_power = 2.8 + (0.4 if day_of_week >= 5 else 0.0) # Morning peak
            elif 18 <= hour <= 22:
                base_power = 3.6 + (0.7 if day_of_week >= 5 else 0.0) # Evening peak
            elif 0 <= hour <= 5:
                base_power = 0.4
            else:
                base_power = 1.2 + (0.3 if day_of_week >= 5 else 0.0)
                
            active_power = max(0.12, base_power + np.random.normal(0, 0.2))
            energy_accumulator += active_power
            
            synthetic_data.append({
                "timestamp": ts,
                "active_power": active_power,
                "voltage": 230.0 + np.random.normal(0, 1.2),
                "current": (active_power * 1000.0) / 230.0,
                "energy_consumed_kwh": energy_accumulator,
                "grid_status": "grid"
            })
            
        df = pd.DataFrame(synthetic_data)
    else:
        data = [{
            "timestamp": m.timestamp,
            "active_power": m.active_power,
            "energy_consumed_kwh": m.energy_consumed_kwh
        } for m in metrics]
        df = pd.DataFrame(data)

    df["hour"] = df["timestamp"].dt.hour
    df["dayofweek"] = df["timestamp"].dt.dayofweek
    df["lag_1"] = df["active_power"].shift(1)
    df["lag_2"] = df["active_power"].shift(2)
    df = df.dropna()
    
    X = df[["hour", "dayofweek", "lag_1", "lag_2"]].values
    y = df["active_power"].values
    
    return X, y

def train_energy_model(db: Session):
    if not HAS_ML:
        print("[FORECASTER] Skipping training, ML libraries are not available.")
        return True
    print("[FORECASTER] Fitting Gradient Boosting models on aggregate histories...")
    try:
        X, y = prepare_training_data(db)
        
        if HAS_XGBOOST:
            try:
                import xgboost as xgb
                model = xgb.XGBRegressor(
                    n_estimators=60,
                    max_depth=4,
                    learning_rate=0.1,
                    random_state=42
                )
                model.fit(X, y)
            except Exception as e:
                print(f"[FORECASTER] XGBoost fit failed: {e}. Falling back to Sklearn...")
                from sklearn.ensemble import GradientBoostingRegressor
                model = GradientBoostingRegressor(n_estimators=60, max_depth=4, learning_rate=0.1, random_state=42)
                model.fit(X, y)
        else:
            from sklearn.ensemble import GradientBoostingRegressor
            model = GradientBoostingRegressor(
                n_estimators=60,
                max_depth=4,
                learning_rate=0.1,
                random_state=42
            )
            model.fit(X, y)
            
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(model, f)
            
        print("[FORECASTER] Energy Forecaster model successfully saved.")
        return True
    except Exception as e:
        print(f"[FORECASTER] Training failed: {e}")
        return False

def get_forecast_payload(db: Session) -> dict:
    """
    Infers recursive forecasts for Next Hour, Next 24 Hours, and Next 7 Days.
    """
    if not HAS_ML:
        # Rule-based pure Python prediction fallback when ML libraries are blocked
        recent_metrics = db.query(EnergyMetric).order_by(EnergyMetric.timestamp.desc()).limit(2).all()
        lag_1 = recent_metrics[0].active_power if len(recent_metrics) > 0 else 1.5
        
        now = datetime.datetime.utcnow()
        hourly_predictions = []
        current_power = lag_1
        
        for i in range(168):
            future_time = now + datetime.timedelta(hours=i)
            hour = future_time.hour
            day_of_week = future_time.weekday()
            
            # Base diurnal patterns
            if 7 <= hour <= 9:
                base_power = 2.8 + (0.4 if day_of_week >= 5 else 0.0) # Morning peak
            elif 18 <= hour <= 22:
                base_power = 3.6 + (0.7 if day_of_week >= 5 else 0.0) # Evening peak
            elif 0 <= hour <= 5:
                base_power = 0.4
            else:
                base_power = 1.2 + (0.3 if day_of_week >= 5 else 0.0)
                
            # Blend starting lag value with base load over first 3 hours
            if i < 3:
                pred_power = current_power * (1.0 - i/3.0) + base_power * (i/3.0)
            else:
                import math
                variation = 0.15 * math.sin(i * 0.5)
                pred_power = max(0.12, base_power + variation)
                
            uncertainty = 0.12 + (i * 0.012)
            confidence_upper = max(0.15, pred_power + uncertainty)
            confidence_lower = max(0.05, pred_power - uncertainty)
            
            hourly_predictions.append({
                "timestamp": future_time,
                "hour_label": f"{hour}:00",
                "predicted_kwh": round(pred_power, 3),
                "confidence_upper": round(confidence_upper, 3),
                "confidence_lower": round(confidence_lower, 3)
            })
            current_power = pred_power

        # 1. Next Hour
        next_hour_data = hourly_predictions[0]
        next_hour = {
            "timestamp": next_hour_data["timestamp"].isoformat() + "Z",
            "predicted_kwh": next_hour_data["predicted_kwh"],
            "confidence_upper": next_hour_data["confidence_upper"],
            "confidence_lower": next_hour_data["confidence_lower"]
        }

        # 2. Next 24 Hours
        next_24h = []
        for h in hourly_predictions[:24]:
            next_24h.append({
                "timestamp": h["timestamp"].isoformat() + "Z",
                "hour_label": h["hour_label"],
                "predicted_kwh": h["predicted_kwh"],
                "confidence_upper": h["confidence_upper"],
                "confidence_lower": h["confidence_lower"]
            })

        # 3. Next 7 Days (Resampled/Aggregated daily totals)
        next_7days = []
        daily_groups = {}
        for h in hourly_predictions:
            date_key = h["timestamp"].date()
            if date_key not in daily_groups:
                daily_groups[date_key] = {
                    "predicted_kwh": 0.0,
                    "confidence_upper": 0.0,
                    "confidence_lower": 0.0
                }
            daily_groups[date_key]["predicted_kwh"] += h["predicted_kwh"]
            daily_groups[date_key]["confidence_upper"] += h["confidence_upper"]
            daily_groups[date_key]["confidence_lower"] += h["confidence_lower"]

        for dt, vals in sorted(daily_groups.items()):
            day_label = dt.strftime("%A (%b %d)")
            next_7days.append({
                "date_label": day_label,
                "predicted_kwh": round(vals["predicted_kwh"], 2),
                "confidence_upper": round(vals["confidence_upper"], 2),
                "confidence_lower": round(vals["confidence_lower"], 2)
            })

        return {
            "next_hour": next_hour,
            "next_24h": next_24h,
            "next_7days": next_7days
        }

    if not os.path.exists(MODEL_PATH):
        train_energy_model(db)
        
    try:
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
    except Exception:
        train_energy_model(db)
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)

    # Lags from most recent database entries
    recent_metrics = db.query(EnergyMetric).order_by(EnergyMetric.timestamp.desc()).limit(2).all()
    lag_1 = recent_metrics[0].active_power if len(recent_metrics) > 0 else 1.5
    lag_2 = recent_metrics[1].active_power if len(recent_metrics) > 1 else 1.2

    now = datetime.datetime.utcnow()
    
    # Predict 168 hours recursively (7 days * 24 hours)
    current_lag_1 = lag_1
    current_lag_2 = lag_2
    
    hourly_predictions = []
    
    for i in range(168):
        future_time = now + datetime.timedelta(hours=i)
        hour = future_time.hour
        dayofweek = future_time.weekday()
        
        X_in = np.array([[hour, dayofweek, current_lag_1, current_lag_2]], dtype=np.float32)
        pred_power = float(model.predict(X_in)[0])
        pred_power = max(0.1, pred_power) # bound positive
        
        # Uncertainty grows over the forecasting horizon (funnel shape)
        uncertainty = 0.12 + (i * 0.012)
        confidence_upper = max(0.15, pred_power + uncertainty)
        confidence_lower = max(0.05, pred_power - uncertainty)

        hourly_predictions.append({
            "timestamp": future_time,
            "hour_label": f"{hour}:00",
            "predicted_kwh": round(pred_power, 3),
            "confidence_upper": round(confidence_upper, 3),
            "confidence_lower": round(confidence_lower, 3)
        })
        
        current_lag_2 = current_lag_1
        current_lag_1 = pred_power

    # 1. Next Hour
    next_hour_data = hourly_predictions[0]
    next_hour = {
        "timestamp": next_hour_data["timestamp"].isoformat() + "Z",
        "predicted_kwh": next_hour_data["predicted_kwh"],
        "confidence_upper": next_hour_data["confidence_upper"],
        "confidence_lower": next_hour_data["confidence_lower"]
    }

    # 2. Next 24 Hours
    next_24h = []
    for h in hourly_predictions[:24]:
        next_24h.append({
            "timestamp": h["timestamp"].isoformat() + "Z",
            "hour_label": h["hour_label"],
            "predicted_kwh": h["predicted_kwh"],
            "confidence_upper": h["confidence_upper"],
            "confidence_lower": h["confidence_lower"]
        })

    # 3. Next 7 Days (Resampled/Aggregated daily totals)
    next_7days = []
    df_hourly = pd.DataFrame(hourly_predictions)
    df_hourly["date_only"] = df_hourly["timestamp"].dt.date
    
    # Sum up hourly predicted loads per day
    df_daily = df_hourly.groupby("date_only").agg({
        "predicted_kwh": "sum",
        "confidence_upper": "sum",
        "confidence_lower": "sum"
    }).reset_index()

    for _, row in df_daily.iterrows():
        dt = row["date_only"]
        day_label = dt.strftime("%A (%b %d)")
        next_7days.append({
            "date_label": day_label,
            "predicted_kwh": round(float(row["predicted_kwh"]), 2),
            "confidence_upper": round(float(row["confidence_upper"]), 2),
            "confidence_lower": round(float(row["confidence_lower"]), 2)
        })

    return {
        "next_hour": next_hour,
        "next_24h": next_24h,
        "next_7days": next_7days
    }

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
