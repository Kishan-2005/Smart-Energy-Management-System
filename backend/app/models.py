import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="home_user")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class EnergyMetric(Base):
    __tablename__ = "energy_metrics"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, index=True, default=datetime.datetime.utcnow)
    active_power = Column(Float, nullable=False)  # kW
    voltage = Column(Float, nullable=False)       # V
    current = Column(Float, nullable=False)       # A
    frequency = Column(Float, default=50.0)      # Hz
    energy_consumed_kwh = Column(Float, default=0.0)
    grid_status = Column(String, default="grid")  # grid, solar, battery

class ApplianceMetric(Base):
    __tablename__ = "appliance_metrics"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, index=True, default=datetime.datetime.utcnow)
    appliance_name = Column(String, index=True, nullable=False)
    power_consumed = Column(Float, nullable=False) # kW
    status = Column(Boolean, default=True)         # True = On, False = Off
    efficiency_grade = Column(String, default="A") # A, B, C, D, etc.

class SolarForecastMetric(Base):
    __tablename__ = "solar_forecast_metrics"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, index=True, nullable=False)
    predicted_generation = Column(Float, nullable=False) # kW
    weather_condition = Column(String, default="Sunny")
    solar_irradiance = Column(Float, default=800.0)      # W/m2

class CostRecommendation(Base):
    __tablename__ = "cost_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    title = Column(String, nullable=False)
    recommendation_text = Column(String, nullable=False)
    potential_saving = Column(Float, default=0.0)       # $ / Rupees
    status = Column(String, default="pending")          # pending, applied, dismissed
    actionable_type = Column(String, default="shift_load")
