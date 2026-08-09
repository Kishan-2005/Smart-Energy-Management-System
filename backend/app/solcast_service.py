import datetime
import math
import random
import requests
from typing import List, Tuple
from sqlalchemy.orm import Session
from app.config import settings
from app.models import SolarForecastMetric

def generate_mock_solcast(lat: float, lon: float, capacity: float) -> Tuple[List[dict], str]:
    # Dynamic simulation of GHI & PV Power forecasts for the next 48 half-hourly intervals
    now = datetime.datetime.utcnow()
    # Align to nearest 30-minute interval
    base_time = now.replace(minute=30 if now.minute >= 30 else 0, second=0, microsecond=0)
    
    forecasts = []
    # Seed based on coordinates to keep it stable
    random.seed(int(lat + lon) + now.day)
    
    # Let's generate a weather condition pool
    cloud_factor = random.uniform(0.1, 0.9) # 0.1 = clear sky, 0.9 = very cloudy
    
    for i in range(48):
        interval_time = base_time + datetime.timedelta(minutes=30 * i)
        hour = interval_time.hour + interval_time.minute / 60.0
        
        # Solar noon bell curve peaking at 12 PM
        if 6.0 <= hour <= 18.0:
            bell = math.exp(-0.5 * ((hour - 12.5) / 2.2) ** 2)
            # Max possible horizontal irradiance is 950 W/m2
            ghi = bell * 950.0 * (1.0 - cloud_factor * 0.7) + random.uniform(-10.0, 10.0)
            ghi = max(0.0, ghi)
            
            # PV Power calculation
            pv_power = capacity * (ghi / 1000.0) * 0.82
            pv_power = max(0.0, pv_power)
        else:
            ghi = 0.0
            pv_power = 0.0
            
        forecasts.append({
            "period_end": interval_time.isoformat() + "Z",
            "ghi": round(ghi, 1),
            "pv_power": round(pv_power, 3),
            "cloud_cover": round(cloud_factor * 100.0, 1)
        })
        
    return forecasts, "demo"

def fetch_live_solcast(
    api_key: str, 
    resource_id: str = None, 
    lat: float = None, 
    lon: float = None,
    capacity: float = 6.5
) -> Tuple[List[dict], str]:
    # Query Solcast API
    headers = {"Authorization": f"Bearer {api_key}"}
    
    if resource_id and resource_id.strip():
        # Live site rooftop forecast (returns PV power directly)
        url = f"https://api.solcast.com.au/rooftop_sites/{resource_id}/forecasts?format=json"
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        forecasts = []
        for item in data.get("forecasts", []):
            pv_power = item.get("pv_power", 0.0)
            # Estimate GHI from power as a fallback
            ghi = (pv_power / (capacity * 0.82)) * 1000.0 if pv_power > 0 else 0.0
            forecasts.append({
                "period_end": item.get("period_end"),
                "ghi": round(ghi, 1),
                "pv_power": round(pv_power, 3),
                "cloud_cover": 30.0 # generic cloud cover fallback
            })
        return forecasts, "live"
    else:
        # Live coordinates radiation forecast
        url = f"https://api.solcast.com.au/data/forecast/radiation_and_weather?latitude={lat}&longitude={lon}&output_parameters=ghi,clouds&format=json&api_key={api_key}"
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        forecasts = []
        for item in data.get("forecasts", []):
            ghi = item.get("ghi", 0.0)
            clouds = item.get("clouds", 0.0)
            # Estimate PV power locally
            pv_power = capacity * (ghi / 1000.0) * 0.82
            forecasts.append({
                "period_end": item.get("period_end"),
                "ghi": round(ghi, 1),
                "pv_power": round(pv_power, 3),
                "cloud_cover": float(clouds)
            })
        return forecasts, "live"

def calculate_battery_soc(forecasts_hourly: List[dict], capacity_kwh: float = 13.5) -> List[dict]:
    # Simulate a 24 hour state of charge curve based on Solcast yield vs household load
    battery_curve = []
    soc = 50.0  # starting state of charge (50%)
    
    now = datetime.datetime.utcnow()
    
    for i in range(24):
        future_time = now + datetime.timedelta(hours=i)
        hour = future_time.hour
        
        # Get expected PV output for this hour
        pv_gen = 0.0
        if i < len(forecasts_hourly):
            pv_gen = forecasts_hourly[i]["predicted_generation"]
            
        # Standard hourly household load model (standby, morning spike, evening peak)
        if 7 <= hour <= 9:
            load = 2.2
        elif 18 <= hour <= 22:
            load = 3.2
        elif 0 <= hour <= 5:
            load = 0.4
        else:
            load = 1.1
            
        net_power = pv_gen - load
        
        # Charge or discharge the battery
        if net_power > 0:
            # Charging efficiency 92%
            soc += (net_power * 1.0 * 0.92) / capacity_kwh * 100.0
        else:
            # Discharging efficiency 95%
            soc += (net_power * 1.0 / 0.95) / capacity_kwh * 100.0
            
        # Bound SOC between 15% and 100%
        soc = max(15.0, min(100.0, soc))
        
        battery_curve.append({
            "hour": f"{hour}:00",
            "soc_percent": round(soc, 1)
        })
        
    return battery_curve

def sync_solcast(
    db: Session, 
    force: bool = False,
    api_key: str = None, 
    resource_id: str = None, 
    lat: float = None, 
    lon: float = None,
    capacity: float = 6.5
) -> Tuple[List[dict], List[dict], str]:
    """
    Syncs forecasts with Solcast API, saves them to database and estimates battery SOC.
    """
    active_api_key = api_key if api_key is not None else settings.SOLCAST_API_KEY
    active_resource_id = resource_id if resource_id is not None else settings.SOLCAST_RESOURCE_ID
    active_lat = lat if lat is not None else settings.LOCATION_LATITUDE
    active_lon = lon if lon is not None else settings.LOCATION_LONGITUDE
    
    integration_mode = "demo"
    
    # 1. Fetch raw forecasts (30-min intervals)
    if active_api_key and active_api_key.strip():
        try:
            raw_forecasts, integration_mode = fetch_live_solcast(
                active_api_key, active_resource_id, active_lat, active_lon, capacity
            )
        except Exception as e:
            print(f"[SOLCAST SERVICE] Error calling live API: {e}. Falling back to simulation.")
            raw_forecasts, integration_mode = generate_mock_solcast(active_lat, active_lon, capacity)
    else:
        raw_forecasts, integration_mode = generate_mock_solcast(active_lat, active_lon, capacity)
        
    # 2. Resample / Aggregate to hourly forecasts for database storage
    hourly_forecasts = []
    # Solcast returns data sequentially. Let's group pairs (every 2 half-hours) to represent hourly averages.
    for idx in range(0, min(len(raw_forecasts), 48), 2):
        if idx + 1 < len(raw_forecasts):
            h1 = raw_forecasts[idx]
            h2 = raw_forecasts[idx+1]
            
            ts = datetime.datetime.fromisoformat(h1["period_end"].replace("Z", ""))
            avg_ghi = (h1["ghi"] + h2["ghi"]) / 2.0
            avg_power = (h1["pv_power"] + h2["pv_power"]) / 2.0
            avg_clouds = (h1["cloud_cover"] + h2["cloud_cover"]) / 2.0
            
            # Map average clouds to weather condition string
            if avg_clouds < 20:
                cond = "Sunny"
            elif avg_clouds < 65:
                cond = "Partly Cloudy"
            else:
                cond = "Overcast"
                
            hourly_forecasts.append({
                "timestamp": ts,
                "hour_label": f"{ts.hour}:00",
                "predicted_generation": round(avg_power, 3),
                "weather_condition": cond,
                "solar_irradiance": round(avg_ghi, 1)
            })
            
    # 3. Store hourly forecasts in database table `solar_forecast_metrics`
    if len(hourly_forecasts) > 0:
        try:
            db.query(SolarForecastMetric).delete()
            for h in hourly_forecasts[:24]: # Store next 24 hours
                sf = SolarForecastMetric(
                    timestamp=h["timestamp"],
                    predicted_generation=h["predicted_generation"],
                    weather_condition=h["weather_condition"],
                    solar_irradiance=h["solar_irradiance"]
                )
                db.add(sf)
            db.commit()
            print("[SOLCAST SERVICE] Successfully stored solar forecasts in database.")
        except Exception as err:
            print(f"[SOLCAST SERVICE] DB Storage failed: {err}")
            
    # 4. Calculate 24-hour battery State of Charge profile
    battery_soc_curve = calculate_battery_soc(hourly_forecasts, capacity_kwh=13.5)
    
    # Return formatted payload
    formatted_hourly_solar = []
    for h in hourly_forecasts[:16]: # Return next 16 hours for charts
        formatted_hourly_solar.append({
            "time": h["hour_label"],
            "generation_kw": h["predicted_generation"],
            "irradiance": h["solar_irradiance"],
            "weather": h["weather_condition"]
        })
        
    return formatted_hourly_solar, battery_soc_curve, integration_mode
