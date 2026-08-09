import datetime
import random
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import User, EnergyMetric, ApplianceMetric, SolarForecastMetric, CostRecommendation
from app.schemas import DashboardStats, EnergyMetricResponse, ApplianceMetricResponse, ApplianceToggle, SolarForecastResponse, CostRecommendationResponse, CostRecommendationUpdate, WeatherResponse
from app.routers.auth import get_current_user
from app.forecaster import get_forecast_payload, predict_solar_generation, train_energy_model
from app.weather_service import sync_weather
from app.solcast_service import sync_solcast



router = APIRouter(prefix="/energy", tags=["Energy Analytics"])

# Helper function to seed mock database data if it's empty
@router.post("/seed", status_code=status.HTTP_201_CREATED)
def seed_database(db: Session = Depends(get_db)):
    # 1. Seed EnergyMetrics (last 24 hours of hourly records)
    if db.query(EnergyMetric).count() == 0:
        now = datetime.datetime.utcnow()
        energy_accumulator = 120.5
        for i in range(24, 0, -1):
            ts = now - datetime.timedelta(hours=i)
            # Simulated hour-based loads: peak during morning (7-9 AM) and evening (6-10 PM)
            hour = ts.hour
            if 7 <= hour <= 9:
                active_power = random.uniform(2.5, 4.5)
            elif 18 <= hour <= 22:
                active_power = random.uniform(3.0, 5.5)
            elif 0 <= hour <= 5:
                active_power = random.uniform(0.3, 0.8)
            else:
                active_power = random.uniform(1.0, 2.2)
            
            voltage = random.uniform(228.0, 234.0)
            current = (active_power * 1000.0) / voltage
            energy_accumulator += active_power  # accumulates hourly

            metric = EnergyMetric(
                timestamp=ts,
                active_power=round(active_power, 3),
                voltage=round(voltage, 1),
                current=round(current, 2),
                frequency=round(random.uniform(49.8, 50.2), 2),
                energy_consumed_kwh=round(energy_accumulator, 2),
                grid_status=random.choices(["grid", "solar", "battery"], weights=[70, 20, 10])[0]
            )
            db.add(metric)

    # 2. Seed ApplianceMetrics
    if db.query(ApplianceMetric).count() == 0:
        appliances = [
            ("Air Conditioner", 2.2, True, "B"),
            ("EV Charger", 7.2, False, "A"),
            ("Refrigerator", 0.18, True, "A+"),
            ("Washing Machine", 0.85, False, "A"),
            ("Water Heater", 3.0, False, "C"),
            ("Lighting & Router", 0.25, True, "A+"),
            ("Home Entertainment", 0.45, True, "B")
        ]
        now = datetime.datetime.utcnow()
        for name, power, is_on, grade in appliances:
            app_metric = ApplianceMetric(
                timestamp=now,
                appliance_name=name,
                power_consumed=power if is_on else 0.0,
                status=is_on,
                efficiency_grade=grade
            )
            db.add(app_metric)

    # 3. Seed SolarForecastMetrics (next 24 hours of predictions)
    if db.query(SolarForecastMetric).count() == 0:
        now = datetime.datetime.utcnow()
        weather_conditions = ["Sunny", "Partly Cloudy", "Sunny", "Overcast", "Sunny"]
        for i in range(24):
            ts = now + datetime.timedelta(hours=i)
            hour = ts.hour
            # Solar generation pattern based on daylight hours
            if 6 <= hour <= 18:
                # curve peaking around 12-1 PM
                bell_curve = math_bell_curve(hour, 12, 3)
                pred_gen = bell_curve * random.uniform(4.5, 5.5)
                irr = bell_curve * 1000.0
                weather = random.choice(weather_conditions)
            else:
                pred_gen = 0.0
                irr = 0.0
                weather = "Clear"
            
            sf = SolarForecastMetric(
                timestamp=ts,
                predicted_generation=round(pred_gen, 3),
                weather_condition=weather,
                solar_irradiance=round(irr, 1)
            )
            db.add(sf)

    # 4. Seed CostRecommendations
    if db.query(CostRecommendation).count() == 0:
        recs = [
            ("Shift EV Charging", "Charge your Electric Vehicle between 2:00 AM and 6:00 AM to take advantage of super off-peak tariffs.", 4.50, "pending", "shift_load"),
            ("AC Temperature Setback", "Increase Thermostat by 2°C during peak hours (5:00 PM - 8:00 PM) to reduce grid consumption load.", 1.80, "pending", "thermostat"),
            ("Battery Discharge Optimization", "Discharge home battery storage to 30% SOC during peak hours (6:00 PM to 9:00 PM) instead of drawing from the grid.", 3.20, "pending", "battery"),
            ("Appliance Idle Control", "Turn off standby mode on home entertainment setups during midnight hours.", 0.60, "applied", "standby")
        ]
        for title, text, saving, status, action_type in recs:
            rec = CostRecommendation(
                title=title,
                recommendation_text=text,
                potential_saving=saving,
                status=status,
                actionable_type=action_type
            )
            db.add(rec)
            
    db.commit()
    return {"message": "Database seeded successfully!"}

def math_bell_curve(x, mean, std_dev):
    import math
    return math.exp(-0.5 * ((x - mean) / std_dev) ** 2)

# GET /stats: Dashboard Overview
@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Trigger auto seed if tables are empty
    if db.query(ApplianceMetric).count() == 0:
        seed_database(db)

    # Fetch active appliances consumption
    active_appliances = db.query(ApplianceMetric).filter(ApplianceMetric.status == True).all()
    current_load = sum(app.power_consumed for app in active_appliances)
    if current_load == 0:
        current_load = 1.45  # fallback baseline

    # Today's solar generation estimate (summing daylight values)
    now = datetime.datetime.utcnow()
    hour = now.hour
    curr_solar = 0.0
    if 6 <= hour <= 18:
        # current solar production
        bell = max(0.0, 1.0 - abs(hour - 12) / 6)
        curr_solar = bell * 4.2

    # Battery mock indicators
    battery_soc = 68.0
    battery_charge_rate = -0.45  # negative represents discharging slightly, positive charging
    if curr_solar > current_load:
        battery_charge_rate = round(curr_solar - current_load, 2)
        battery_soc = min(100.0, battery_soc + 2.0)
    else:
        battery_charge_rate = round(curr_solar - current_load, 2)
        battery_soc = max(10.0, battery_soc - 1.2)

    # Fetch total consumption from the database metrics
    metrics_24h = db.query(EnergyMetric).order_by(EnergyMetric.timestamp.desc()).limit(24).all()
    today_consumption = sum(m.active_power for m in metrics_24h) if metrics_24h else 18.5
    today_solar = sum(m.predicted_generation for m in db.query(SolarForecastMetric).limit(24).all()) if db.query(SolarForecastMetric).count() > 0 else 12.4

    # Financial details
    today_cost = today_consumption * 0.16  # standard 16c/kWh average
    savings = 48.35
    co2_saved = today_solar * 0.42  # 0.42 kg CO2 saved per kWh solar

    # Grid dependence (if load is 3kW and solar is 1kW, remaining 2kW from grid/battery)
    # let's write a calculated value
    grid_dep = max(0.0, min(100.0, ((current_load - max(0.0, curr_solar)) / current_load) * 100.0)) if current_load > 0 else 0.0

    return DashboardStats(
        current_load_kw=round(current_load, 2),
        today_consumption_kwh=round(today_consumption, 2),
        today_solar_generation_kwh=round(today_solar, 2),
        current_solar_production_kw=round(curr_solar, 2),
        battery_soc_percent=round(battery_soc, 1),
        battery_charging_rate_kw=round(battery_charge_rate, 2),
        today_cost_estimate=round(today_cost, 2),
        grid_dependence_percent=round(grid_dep, 1),
        savings_this_month=round(savings, 2),
        co2_saved_kg=round(co2_saved, 2)
    )

# GET /live: Live updating grid metrics
@router.get("/live", response_model=EnergyMetricResponse)
def get_live_metrics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Generate completely real-time randomized telemetry parameters
    # representing physical IoT sensor endpoints
    active_appliances = db.query(ApplianceMetric).filter(ApplianceMetric.status == True).all()
    active_power = sum(app.power_consumed for app in active_appliances)
    # add small fluctuation
    active_power = max(0.1, active_power + random.uniform(-0.15, 0.15))
    
    voltage = random.uniform(229.5, 232.8)
    current = (active_power * 1000.0) / voltage
    freq = random.uniform(49.92, 50.08)

    # get last reading to accumulate energy
    last_record = db.query(EnergyMetric).order_by(EnergyMetric.timestamp.desc()).first()
    new_energy_kwh = (last_record.energy_consumed_kwh if last_record else 125.4) + (active_power / 3600.0) # assuming 1-sec polling interval

    metric = EnergyMetric(
        timestamp=datetime.datetime.utcnow(),
        active_power=round(active_power, 3),
        voltage=round(voltage, 1),
        current=round(current, 2),
        frequency=round(freq, 2),
        energy_consumed_kwh=round(new_energy_kwh, 4),
        grid_status="grid" if active_power > 1.5 else "solar"
    )
    # save to database so the history grows
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return metric

# GET /forecast: Pred vs Hist hourly list using AI Random Forest model
@router.get("/forecast")
def get_forecast_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Trigger auto seed if tables are empty
    if db.query(ApplianceMetric).count() == 0:
        seed_database(db)

    # 1. Fetch recursive forecasts from the trained XGBoost model
    from app.forecaster import get_forecast_payload
    payload = get_forecast_payload(db)

    # 2. Fetch historical baseline (last 12 hours) for graph alignment
    now = datetime.datetime.utcnow()
    historical = []
    for i in range(12, 0, -1):
        ts = now - datetime.timedelta(hours=i)
        hour = ts.hour
        base_load = 0.5 + 1.2 * math_bell_curve(hour, 8, 2) + 2.1 * math_bell_curve(hour, 19, 2)
        historical.append({
            "timestamp": ts.isoformat() + "Z",
            "hour_label": f"{hour}:00",
            "actual_kwh": round(base_load + random.uniform(-0.15, 0.15), 2),
            "predicted_kwh": round(base_load, 2)
        })

    return {
        "historical_12h": historical,
        "next_hour": payload["next_hour"],
        "forecast_24h": payload["next_24h"],
        "forecast_7d": payload["next_7days"]
    }

# POST /train: Retrain AI model
@router.post("/train", status_code=status.HTTP_200_OK)
def train_model_endpoint(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    success = train_energy_model(db)
    if not success:
        raise HTTPException(status_code=500, detail="AI Model training failed")
    return {"status": "success", "message": "Model trained and saved successfully"}

# GET /appliances: List of appliances
@router.get("/appliances", response_model=List[ApplianceMetricResponse])
def get_appliances(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Auto seed if empty
    if db.query(ApplianceMetric).count() == 0:
        seed_database(db)
    
    return db.query(ApplianceMetric).all()

# POST /appliances/{appliance_id}/toggle
@router.post("/appliances/{appliance_id}/toggle", response_model=ApplianceMetricResponse)
def toggle_appliance(appliance_id: int, toggle: ApplianceToggle, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    appliance = db.query(ApplianceMetric).filter(ApplianceMetric.id == appliance_id).first()
    if not appliance:
        raise HTTPException(status_code=404, detail="Appliance not found")
    
    # Update status
    appliance.status = toggle.status
    # If turned off, usage drops to 0. If turned on, assign default load
    if toggle.status:
        # Mock load mapping
        loads = {
            "Air Conditioner": 2.2,
            "EV Charger": 7.2,
            "Refrigerator": 0.18,
            "Washing Machine": 0.85,
            "Water Heater": 3.0,
            "Lighting & Router": 0.25,
            "Home Entertainment": 0.45
        }
        appliance.power_consumed = loads.get(appliance.appliance_name, 1.0)
    else:
        appliance.power_consumed = 0.0
        
    db.commit()
    db.refresh(appliance)
    return appliance

# GET /solar: Solar forecasts & Battery analytics
@router.get("/solar")
def get_solar_analytics(
    api_key: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    location: Optional[str] = None,
    solcast_api_key: Optional[str] = None,
    solcast_resource_id: Optional[str] = None,
    capacity: Optional[float] = 6.5,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # 1. Sync weather first, which retrieves weather forecast list
    current_m, forecast_list, weather_mode = sync_weather(
        db, 
        force=False,
        api_key=api_key,
        lat=lat,
        lon=lon,
        location=location
    )

    # 2. Sync Solcast solar forecasts and battery SOC charge cycles
    solcast_hourly_solar, battery_soc_curve, solcast_mode = sync_solcast(
        db,
        force=False,
        api_key=solcast_api_key,
        resource_id=solcast_resource_id,
        lat=lat,
        lon=lon,
        capacity=capacity or 6.5
    )

    return {
        "hourly_solar": solcast_hourly_solar,
        "weather_forecast": forecast_list,
        "battery_soc_curve": battery_soc_curve,
        "system_capacity_kw": capacity or 6.5,
        "battery_capacity_kwh": 13.5,
        "solcast_integration_type": solcast_mode
    }


# GET /weather: Current and forecast weather
@router.get("/weather", response_model=WeatherResponse)
def get_weather(
    api_key: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    location: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    current_m, forecast_list, integration_mode = sync_weather(
        db, 
        force=False,
        api_key=api_key,
        lat=lat,
        lon=lon,
        location=location
    )
    return {
        "current": current_m,
        "forecast": forecast_list,
        "integration_type": integration_mode
    }

# POST /weather/refresh: Force refresh weather
@router.post("/weather/refresh", response_model=WeatherResponse)
def refresh_weather(
    api_key: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    location: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    current_m, forecast_list, integration_mode = sync_weather(
        db, 
        force=True,
        api_key=api_key,
        lat=lat,
        lon=lon,
        location=location
    )
    return {
        "current": current_m,
        "forecast": forecast_list,
        "integration_type": integration_mode
    }



# GET /cost/optimizer: Recommendations & Tariff structures
@router.get("/cost/optimizer")
def get_cost_optimization(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.query(CostRecommendation).count() == 0:
        seed_database(db)

    recommendations = db.query(CostRecommendation).all()

    # Time-of-use tariffs structure
    tariffs = [
        {"time": "00:00 - 06:00", "rate": 0.08, "type": "Off-Peak", "color": "#10B981"},
        {"time": "06:00 - 16:00", "rate": 0.15, "type": "Mid-Peak", "color": "#F59E0B"},
        {"time": "16:00 - 21:00", "rate": 0.28, "type": "On-Peak", "color": "#EF4444"},
        {"time": "21:00 - 24:00", "rate": 0.12, "type": "Off-Peak", "color": "#10B981"}
    ]

    return {
        "recommendations": recommendations,
        "tariffs": tariffs,
        "monthly_potential_savings": 28.50,
        "billing_cycle_progress": 65  # percentage
    }

# PUT /cost/optimizer/recommendations/{rec_id}
@router.put("/cost/optimizer/recommendations/{rec_id}", response_model=CostRecommendationResponse)
def update_recommendation_status(rec_id: int, payload: CostRecommendationUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rec = db.query(CostRecommendation).filter(CostRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    
    rec.status = payload.status
    db.commit()
    db.refresh(rec)
    return rec

# GET /reports: Logs/History summary for downloads
@router.get("/reports")
def get_reports_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Generate past 7 days reports database records
    now = datetime.datetime.utcnow().date()
    reports = []
    for i in range(7):
        date_val = now - datetime.timedelta(days=i)
        
        consumption = round(random.uniform(15.2, 24.8), 2)
        generation = round(random.uniform(8.0, 16.5), 2)
        grid_imported = round(max(2.0, consumption - generation * 0.7), 2)
        grid_exported = round(max(0.0, generation * 0.7 - consumption), 2)
        
        rate = 0.15  # standard average rate
        cost = round((grid_imported * rate) - (grid_exported * 0.08), 2)
        savings = round(generation * 0.12, 2)
        efficiency = round((generation / consumption) * 100.0, 1) if consumption > 0 else 100.0

        reports.append({
            "date": date_val.strftime("%Y-%m-%d"),
            "consumption_kwh": consumption,
            "solar_generation_kwh": generation,
            "grid_imported_kwh": grid_imported,
            "grid_exported_kwh": grid_exported,
            "net_cost": cost,
            "savings": savings,
            "efficiency_ratio": min(100.0, efficiency)
        })

    return {
        "daily_summaries": reports,
        "monthly_totals": {
            "consumption_kwh": 582.4,
            "solar_generation_kwh": 348.6,
            "net_cost": 62.40,
            "savings": 45.10
        }
    }

# WebSocket endpoint to stream real-time Smart Meter metrics
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    from app.simulator import manager
    await manager.connect(websocket)
    try:
        while True:
            # Maintain connection and listen for client closing ping/pongs
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# GET /latest: Fetch the single most recent telemetry record
@router.get("/latest", response_model=EnergyMetricResponse)
def get_latest_metric(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    metric = db.query(EnergyMetric).order_by(EnergyMetric.timestamp.desc()).first()
    if not metric:
        raise HTTPException(status_code=404, detail="No telemetry records found")
    return metric

# GET /history: Fetch the last N telemetry records
@router.get("/history", response_model=List[EnergyMetricResponse])
def get_history_metrics(limit: int = 60, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    metrics = db.query(EnergyMetric).order_by(EnergyMetric.timestamp.desc()).limit(limit).all()
    # Reverse to return in chronological order
    return metrics[::-1]

# Helper for time-based aggregations
def get_aggregated_metrics(db: Session, freq: str):
    import pandas as pd
    metrics = db.query(EnergyMetric).order_by(EnergyMetric.timestamp.asc()).all()
    if not metrics:
        return []
    
    data = [{
        "timestamp": m.timestamp,
        "active_power": m.active_power,
        "voltage": m.voltage,
        "current": m.current,
        "frequency": m.frequency,
        "energy_consumed_kwh": m.energy_consumed_kwh
    } for m in metrics]
    df = pd.DataFrame(data)
    
    df.set_index("timestamp", inplace=True)
    
    # Resample: 'D' for Daily, 'W' for Weekly, 'M' for Monthly
    resampled = df.resample(freq).agg({
        "active_power": "mean",
        "voltage": "mean",
        "current": "mean",
        "frequency": "mean",
        "energy_consumed_kwh": "max"
    })
    
    # Calculate net consumption based on resampled steps
    resampled["net_consumption_kwh"] = resampled["energy_consumed_kwh"].diff()
    # Fill first NaN value using active power average multiplier
    mult = 24.0 if freq == 'D' else 168.0 if freq == 'W' else 720.0
    resampled["net_consumption_kwh"] = resampled["net_consumption_kwh"].fillna(resampled["active_power"] * mult)
    
    resampled = resampled.reset_index()
    resampled = resampled.fillna(0.0)
    
    # Create labels
    resampled["date_label"] = resampled["timestamp"].dt.strftime("%Y-%m-%d")
    if freq == 'W':
        resampled["date_label"] = "Week " + resampled["timestamp"].dt.strftime("%U (%b %d)")
    elif freq == 'M':
        resampled["date_label"] = resampled["timestamp"].dt.strftime("%B %Y")
        
    result = []
    for _, row in resampled.iterrows():
        result.append({
            "date_label": row["date_label"],
            "avg_active_power": round(float(row["active_power"]), 3),
            "avg_voltage": round(float(row["voltage"]), 1),
            "avg_current": round(float(row["current"]), 2),
            "avg_frequency": round(float(row["frequency"]), 2),
            "max_energy_kwh": round(float(row["energy_consumed_kwh"]), 2),
            "net_consumption_kwh": round(float(max(0.0, row["net_consumption_kwh"])), 2)
        })
        
    return result

# GET /daily: Fetch daily aggregated telemetry
@router.get("/daily")
def get_daily_metrics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_aggregated_metrics(db, 'D')

# GET /weekly: Fetch weekly aggregated telemetry
@router.get("/weekly")
def get_weekly_metrics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_aggregated_metrics(db, 'W')

# GET /monthly: Fetch monthly aggregated telemetry
@router.get("/monthly")
def get_monthly_metrics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_aggregated_metrics(db, 'M')
