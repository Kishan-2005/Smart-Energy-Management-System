import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Smart Energy Management System"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("JWT_SECRET", "super_secret_key_change_me_in_production_1234567890")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Database URL, default to postgresql with sqlite fallback handled in db.py
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/auraenergy")

    # OpenWeatherMap Integration settings
    OPENWEATHERMAP_API_KEY: Optional[str] = os.getenv("OPENWEATHERMAP_API_KEY", None)
    LOCATION_LATITUDE: float = float(os.getenv("LOCATION_LATITUDE", "12.9716"))
    LOCATION_LONGITUDE: float = float(os.getenv("LOCATION_LONGITUDE", "77.5946"))
    LOCATION_NAME: str = os.getenv("LOCATION_NAME", "Bengaluru")

    # Solcast Integration settings
    SOLCAST_API_KEY: Optional[str] = os.getenv("SOLCAST_API_KEY", None)
    SOLCAST_RESOURCE_ID: Optional[str] = os.getenv("SOLCAST_RESOURCE_ID", None)


    class Config:
        case_sensitive = True

settings = Settings()

