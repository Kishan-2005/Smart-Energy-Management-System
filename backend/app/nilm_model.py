import os
import pickle
import datetime
import random
HAS_ML = True
try:
    import numpy as np
    import pandas as pd
    HAS_ML = True
except ImportError:
    HAS_ML = False
    print("[NILM-AI] WARNING: ML libraries (numpy/pandas) could not be loaded due to security/policy controls.")
    print("[NILM-AI] Falling back to pure Python rule-based disaggregation.")

# Fallback check: If Windows Application Control blocks xgboost.dll, use scikit-learn Gradient Boosting
HAS_XGBOOST = False
if HAS_ML:
    try:
        import xgboost as xgb
        # Simple check to see if DLL loads without triggering WinError 4551
        test_reg = xgb.XGBRegressor(n_estimators=1)
        HAS_XGBOOST = True
        print("[NILM-AI] XGBoost library imported and verified successfully.")
    except Exception as e:
        print(f"[NILM-AI] WARNING: XGBoost C++ library loading failed: {e}")
        print("[NILM-AI] Falling back to Scikit-Learn GradientBoostingRegressor (100% compliant).")
        try:
            from sklearn.ensemble import GradientBoostingRegressor
        except ImportError:
            HAS_ML = False
            print("[NILM-AI] WARNING: Scikit-Learn could not be loaded. Falling back to pure Python models.")

MODEL_FILE = os.path.join(os.path.dirname(__file__), "nilm_xgb_models.pkl")
_loaded_models = None

def generate_ukdale_synthetic_data(num_samples=8000):
    """
    Generates high-fidelity synthetic telemetry datasets replicating UK-DALE signatures:
    - Fridge: draws ~0.18 kW, cycle-based (active 1/3 of the time).
    - TV: draws ~0.12 kW, active mainly in the evening (5 PM - 11 PM).
    - Fan: draws ~0.07 kW, active during mid-day (10 AM - 6 PM).
    - AC: draws ~1.80 kW, active in afternoon heat hours (11 AM - 5 PM).
    - Washing Machine: draws ~1.20 kW, active mostly on weekend days.
    """
    print("[NILM-AI] Generating UK-DALE representative training data...")
    np.random.seed(42)
    random.seed(42)

    base_time = datetime.datetime(2026, 1, 1)
    timestamps = [base_time + datetime.timedelta(minutes=5 * i) for i in range(num_samples)]

    data = []
    for ts in timestamps:
        hour = ts.hour
        day_of_week = ts.weekday()

        # 1. Simulate individual appliance power states
        fridge_on = ((ts.minute + ts.hour * 60) // 20) % 3 == 0
        fridge_power = 0.18 + random.uniform(-0.02, 0.02) if fridge_on else 0.0

        tv_on = 17 <= hour <= 23 and random.random() < 0.8
        tv_power = 0.12 + random.uniform(-0.01, 0.01) if tv_on else 0.0

        fan_on = 10 <= hour <= 18 and random.random() < 0.5
        fan_power = 0.07 + random.uniform(-0.005, 0.005) if fan_on else 0.0

        ac_on = 11 <= hour <= 17 and random.random() < 0.6
        ac_power = 1.80 + random.uniform(-0.15, 0.15) if ac_on else 0.0

        wm_on = day_of_week >= 5 and 8 <= hour <= 16 and random.random() < 0.3
        wm_power = 1.20 + random.uniform(-0.1, 0.1) if wm_on else 0.0

        standby_power = 0.05 + random.uniform(-0.01, 0.01)
        aggregate_power = fridge_power + tv_power + fan_power + ac_power + wm_power + standby_power

        data.append({
            "hour": hour,
            "day_of_week": day_of_week,
            "fridge": fridge_power,
            "tv": tv_power,
            "fan": fan_power,
            "ac": ac_power,
            "washing_machine": wm_power,
            "aggregate": aggregate_power
        })

    return pd.DataFrame(data)

def train_nilm_models():
    """
    Fits 5 separate Gradient Boosting regressors (XGBoost or Scikit-Learn fallback) 
    to disaggregate aggregate active power.
    """
    if not HAS_ML:
        print("[NILM-AI] Skipping training, ML libraries are not available.")
        return True
    df = generate_ukdale_synthetic_data()
    X = df[["aggregate", "hour", "day_of_week"]].values
    
    appliances = ["fridge", "tv", "fan", "ac", "washing_machine"]
    models = {}

    print(f"[NILM-AI] Training models (Using XGBoost: {HAS_XGBOOST})...")
    
    for app in appliances:
        y = df[app].values
        if HAS_XGBOOST:
            try:
                import xgboost as xgb
                model = xgb.XGBRegressor(
                    n_estimators=40,
                    max_depth=4,
                    learning_rate=0.1,
                    random_state=42
                )
                model.fit(X, y)
                models[app] = model
            except Exception as e:
                print(f"[NILM-AI] Fit failed for {app} using XGBoost: {e}. Falling back to Sklearn...")
                from sklearn.ensemble import GradientBoostingRegressor
                model = GradientBoostingRegressor(n_estimators=40, max_depth=4, learning_rate=0.1, random_state=42)
                model.fit(X, y)
                models[app] = model
        else:
            from sklearn.ensemble import GradientBoostingRegressor
            model = GradientBoostingRegressor(
                n_estimators=40,
                max_depth=4,
                learning_rate=0.1,
                random_state=42
            )
            model.fit(X, y)
            models[app] = model
            
        print(f"[NILM-AI] Trained disaggregation tree model for: {app}")

    with open(MODEL_FILE, "wb") as f:
        pickle.dump(models, f)
    print(f"[SUCCESS] NILM disaggregation models saved to: {MODEL_FILE}")

def predict_disaggregated_loads(aggregate_kw: float, timestamp: datetime.datetime) -> dict:
    """
    Infers the disaggregated appliance loads from the aggregate power.
    """
    if not HAS_ML:
        # Heuristics based on active periods and aggregate power when ML packages are blocked
        hour = timestamp.hour
        day_of_week = timestamp.weekday()

        # Standard standby power is 0.05 kW
        standby = 0.05
        remaining = max(0.0, aggregate_kw - standby)

        # Refrigerator: active 1/3 of the time, draws ~0.18 kW
        fridge_on = ((timestamp.minute + timestamp.hour * 60) // 20) % 3 == 0
        fridge_val = 0.18 if (fridge_on and remaining >= 0.15) else 0.0
        remaining = max(0.0, remaining - fridge_val)

        # TV: active 5 PM - 11 PM, draws ~0.12 kW
        tv_on = 17 <= hour <= 23
        tv_val = 0.12 if (tv_on and remaining >= 0.10) else 0.0
        remaining = max(0.0, remaining - tv_val)

        # Fan: active 10 AM - 6 PM, draws ~0.07 kW
        fan_on = 10 <= hour <= 18
        fan_val = 0.07 if (fan_on and remaining >= 0.05) else 0.0
        remaining = max(0.0, remaining - fan_val)

        # AC: active 11 AM - 5 PM, draws ~1.80 kW
        ac_on = 11 <= hour <= 17
        ac_val = 1.80 if (ac_on and remaining >= 1.20) else 0.0
        if aggregate_kw >= 2.0 and not ac_val:
            ac_val = min(remaining, 1.80)
        remaining = max(0.0, remaining - ac_val)

        # Washing Machine: weekend days 8 AM - 4 PM, draws ~1.20 kW
        wm_on = day_of_week >= 5 and 8 <= hour <= 16
        wm_val = 1.20 if (wm_on and remaining >= 0.80) else 0.0
        if remaining >= 1.0 and not wm_val and not ac_val:
            if day_of_week >= 5:
                wm_val = min(remaining, 1.20)
            else:
                ac_val = min(remaining, 1.80)
        remaining = max(0.0, remaining - wm_val)

        # Build disaggregated predictions
        predictions = {
            "fan": round(fan_val, 3),
            "tv": round(tv_val, 3),
            "refrigerator": round(fridge_val, 3),
            "washing_machine": round(wm_val, 3),
            "ac": round(ac_val, 3)
        }

        # Normalize to aggregate_kw exactly if we have any active appliance
        total_predicted = sum(predictions.values()) + standby
        if total_predicted > 0:
            factor = aggregate_kw / total_predicted
            for k in predictions:
                predictions[k] = round(predictions[k] * factor, 3)
                
        return predictions

    global _loaded_models
    
    if _loaded_models is None:
        if not os.path.exists(MODEL_FILE):
            train_nilm_models()
            
        try:
            with open(MODEL_FILE, "rb") as f:
                _loaded_models = pickle.load(f)
            print("[NILM-AI] Loaded disaggregation models into cache.")
        except Exception as e:
            print(f"[NILM-AI] Error loading models: {e}")
            return {
                "fan": 0.0, "tv": 0.0, "refrigerator": 0.0, 
                "washing_machine": 0.0, "ac": 0.0
            }

    hour = timestamp.hour
    day_of_week = timestamp.weekday()
    X_in = np.array([[aggregate_kw, hour, day_of_week]], dtype=np.float32)
    
    predictions = {}
    total_predicted = 0.0

    key_mapping = {
        "fan": "fan",
        "tv": "tv",
        "fridge": "refrigerator",
        "washing_machine": "washing_machine",
        "ac": "ac"
    }

    for app, model in _loaded_models.items():
        ui_key = key_mapping[app]
        pred = float(model.predict(X_in)[0])
        pred_val = max(0.0, pred)
        
        # Zero out tiny loads
        if pred_val < 0.015:
            pred_val = 0.0
            
        predictions[ui_key] = pred_val
        total_predicted += pred_val

    # Normalize predictions to conserve energy
    if total_predicted > aggregate_kw and aggregate_kw > 0:
        factor = aggregate_kw / total_predicted
        for ui_key in predictions:
            predictions[ui_key] = round(predictions[ui_key] * factor, 3)
    else:
        for ui_key in predictions:
            predictions[ui_key] = round(predictions[ui_key], 3)

    return predictions
