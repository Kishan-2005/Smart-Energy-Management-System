import datetime
import math
import random
import requests
from typing import List, Tuple
from sqlalchemy.orm import Session
from app.config import settings
from app.models import WeatherMetric, SolarForecastMetric

def get_day_label(date_val: datetime.date) -> str:
    today = datetime.date.today()
    tomorrow = today + datetime.timedelta(days=1)
    if date_val == today:
        return "Today"
    elif date_val == tomorrow:
        return "Tomorrow"
    else:
        return date_val.strftime("%A")

def map_cloud_cover_to_condition(clouds: float, weather_main: str = "") -> str:
    weather_main_lower = weather_main.lower()
    if any(kw in weather_main_lower for kw in ["rain", "drizzle", "thunderstorm", "snow"]):
        return "Rainy"
    elif clouds < 20:
        return "Sunny"
    elif clouds < 65:
        return "Partly Cloudy"
    else:
        return "Overcast"

def calculate_solar_score(cloud_cover: float, condition: str) -> float:
    # Less clouds = higher solar score. Rainy condition drops it further.
    base_score = 10.0 - (cloud_cover / 100.0) * 6.5
    if condition == "Rainy":
        base_score = max(1.0, base_score - 2.5)
    return round(max(1.0, min(10.0, base_score)), 1)

def generate_mock_forecast(lat: float, lon: float, location: str) -> Tuple[WeatherMetric, List[dict]]:
    # Dynamic dynamic mock generation based on local time sinusoids
    now = datetime.datetime.utcnow()
    
    # 1. Current Weather
    hour = now.hour
    # Temperature peaks at 2 PM (14:00 UTC/local)
    temp = 25.0 + 6.0 * math.sin((hour - 8) / 24.0 * 2.0 * math.pi) + random.uniform(-1.0, 1.0)
    # Humidity is inverse of temperature
    humidity = 65.0 - 15.0 * math.sin((hour - 8) / 24.0 * 2.0 * math.pi) + random.uniform(-3.0, 3.0)
    wind_speed = 2.0 + 1.5 * math.sin((hour - 12) / 24.0 * 2.0 * math.pi) + random.uniform(-0.5, 0.5)
    
    # Random cloud cover
    random.seed(now.minute)
    cloud_cover = float(random.randint(10, 85))
    condition = map_cloud_cover_to_condition(cloud_cover)
    
    current_metric = WeatherMetric(
        timestamp=now,
        temperature=round(temp, 1),
        humidity=round(humidity, 1),
        wind_speed=round(wind_speed, 1),
        cloud_cover=round(cloud_cover, 1),
        condition=condition,
        location=location
    )
    
    # 2. 5-Day Forecast
    forecast_cards = []
    conditions_pool = ["Sunny", "Partly Cloudy", "Sunny", "Overcast", "Rainy"]
    
    for i in range(5):
        future_date = (now + datetime.timedelta(days=i)).date()
        day_lbl = get_day_label(future_date)
        
        # Add some variance daily
        day_temp = round(24.0 + random.uniform(-3.0, 4.0), 1)
        day_humidity = round(60.0 + random.uniform(-10.0, 15.0), 1)
        day_wind = round(2.5 + random.uniform(-1.0, 2.5), 1)
        day_clouds = round(random.uniform(5.0, 95.0), 1)
        
        day_cond = map_cloud_cover_to_condition(day_clouds, random.choice(conditions_pool) if day_clouds > 50 else "")
        score = calculate_solar_score(day_clouds, day_cond)
        
        forecast_cards.append({
            "day": day_lbl,
            "temp": f"{day_temp}°C",
            "condition": day_cond,
            "humidity": day_humidity,
            "wind_speed": day_wind,
            "cloud_cover": day_clouds,
            "solar_score": score
        })
        
    return current_metric, forecast_cards

def fetch_live_weather(lat: float, lon: float, api_key: str, location: str) -> Tuple[WeatherMetric, List[dict]]:
    # Query OpenWeatherMap 5-Day / 3-Hour Forecast API
    url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={api_key}&units=metric"
    response = requests.get(url, timeout=5)
    response.raise_for_status()
    data = response.json()
    
    # Extract current weather from the first forecast index (most immediate)
    immediate = data["list"][0]
    temp = immediate["main"]["temp"]
    humidity = immediate["main"]["humidity"]
    wind_speed = immediate["wind"]["speed"]
    cloud_cover = immediate["clouds"]["all"]
    weather_main = immediate["weather"][0]["main"]
    
    city_name = data.get("city", {}).get("name", location)
    
    current_metric = WeatherMetric(
        timestamp=datetime.datetime.utcnow(),
        temperature=round(temp, 1),
        humidity=round(humidity, 1),
        wind_speed=round(wind_speed, 1),
        cloud_cover=round(cloud_cover, 1),
        condition=map_cloud_cover_to_condition(cloud_cover, weather_main),
        location=city_name
    )
    
    # Extract 5-day forecast by grouping the 3-hour forecasts by day
    daily_groups = {}
    for item in data["list"]:
        dt = datetime.datetime.utcfromtimestamp(item["dt"])
        day_key = dt.date()
        if day_key not in daily_groups:
            daily_groups[day_key] = []
        daily_groups[day_key].append(item)
    
    forecast_cards = []
    # Take the first 5 sorted days
    sorted_days = sorted(list(daily_groups.keys()))[:5]
    for day in sorted_days:
        day_items = daily_groups[day]
        # Average the values
        avg_temp = sum(item["main"]["temp"] for item in day_items) / len(day_items)
        avg_hum = sum(item["main"]["humidity"] for item in day_items) / len(day_items)
        avg_wind = sum(item["wind"]["speed"] for item in day_items) / len(day_items)
        avg_clouds = sum(item["clouds"]["all"] for item in day_items) / len(day_items)
        
        # Most common condition of the day
        conditions = [item["weather"][0]["main"] for item in day_items]
        most_common_main = max(set(conditions), key=conditions.count)
        
        day_cond = map_cloud_cover_to_condition(avg_clouds, most_common_main)
        score = calculate_solar_score(avg_clouds, day_cond)
        
        forecast_cards.append({
            "day": get_day_label(day),
            "temp": f"{round(avg_temp, 1)}°C",
            "condition": day_cond,
            "humidity": round(avg_hum, 1),
            "wind_speed": round(avg_wind, 1),
            "cloud_cover": round(avg_clouds, 1),
            "solar_score": score
        })
        
    return current_metric, forecast_cards

def update_solar_forecast_metrics(db: Session, forecast_cards: List[dict]):
    # Propagate the forecast metrics to SolarForecastMetric database table
    now = datetime.datetime.utcnow()
    # Let's delete existing solar forecast metrics and replace them with updated metrics
    db.query(SolarForecastMetric).delete()
    
    # Populate next 24 hours of solar forecasts hourly
    # We will interpolate using the forecast score for the day
    for i in range(24):
        ts = now + datetime.timedelta(hours=i)
        hour = ts.hour
        
        # Find corresponding forecast card
        day_diff = i // 24
        if day_diff < len(forecast_cards):
            card = forecast_cards[day_diff]
            score = card["solar_score"]
            condition = card["condition"]
        else:
            score = 8.0
            condition = "Partly Cloudy"
            
        # Calculate generation bell curve peaking around 12 PM
        if 6 <= hour <= 18:
            bell_curve = math.exp(-0.5 * ((hour - 12) / 2.5) ** 2)
            # Max capacity is 5.2 kW, scaled by the solar score / 10
            pred_gen = bell_curve * 5.2 * (score / 10.0)
            irr = bell_curve * 1000.0 * (score / 10.0)
        else:
            pred_gen = 0.0
            irr = 0.0
            
        sf = SolarForecastMetric(
            timestamp=ts,
            predicted_generation=round(pred_gen, 3),
            weather_condition=condition,
            solar_irradiance=round(irr, 1)
        )
        db.add(sf)
    db.commit()

def sync_weather(
    db: Session, 
    force: bool = False,
    api_key: str = None,
    lat: float = None,
    lon: float = None,
    location: str = None
) -> Tuple[WeatherMetric, List[dict], str]:
    """
    Retrieves weather data. First checks the database cache (valid for 15 mins).
    If cached data doesn't exist or force=True, queries live API or simulation fallback.
    """
    cache_time = datetime.datetime.utcnow() - datetime.timedelta(minutes=15)
    
    # Use overrides if provided, otherwise default to settings
    active_api_key = api_key if api_key is not None else settings.OPENWEATHERMAP_API_KEY
    active_lat = lat if lat is not None else settings.LOCATION_LATITUDE
    active_lon = lon if lon is not None else settings.LOCATION_LONGITUDE
    active_loc_name = location if location is not None else settings.LOCATION_NAME

    if not force:
        # Check database cache for recent record matching the location
        cached_record = db.query(WeatherMetric).filter(
            WeatherMetric.location == active_loc_name
        ).order_by(WeatherMetric.timestamp.desc()).first()
        
        if cached_record and cached_record.timestamp >= cache_time:
            # Generate forecast cards aligning with cached record
            current_metric, forecast_cards = generate_mock_forecast(
                active_lat, 
                active_lon, 
                cached_record.location
            )
            # Override current metric with the exact cached record values
            cached_record_metric = WeatherMetric(
                id=cached_record.id,
                timestamp=cached_record.timestamp,
                temperature=cached_record.temperature,
                humidity=cached_record.humidity,
                wind_speed=cached_record.wind_speed,
                cloud_cover=cached_record.cloud_cover,
                condition=cached_record.condition,
                location=cached_record.location
            )
            integration_mode = "live" if active_api_key else "demo"
            return cached_record_metric, forecast_cards, integration_mode

    # Fetch fresh
    integration_mode = "demo"
    if active_api_key and active_api_key.strip():
        try:
            current_metric, forecast_cards = fetch_live_weather(active_lat, active_lon, active_api_key, active_loc_name)
            integration_mode = "live"
        except Exception as e:
            print(f"[WEATHER SERVICE] Error calling live API: {e}. Falling back to simulation.")
            current_metric, forecast_cards = generate_mock_forecast(active_lat, active_lon, active_loc_name)
    else:
        current_metric, forecast_cards = generate_mock_forecast(active_lat, active_lon, active_loc_name)
        
    # Save current to DB
    db.add(current_metric)
    db.commit()
    db.refresh(current_metric)
    
    # Update Solar forecasts table based on new score
    try:
        update_solar_forecast_metrics(db, forecast_cards)
    except Exception as err:
        print(f"[WEATHER SERVICE] Error updating solar metrics: {err}")
        
    return current_metric, forecast_cards, integration_mode

