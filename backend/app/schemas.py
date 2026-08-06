from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: Optional[str] = "home_user"

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Energy Metrics Schemas
class EnergyMetricBase(BaseModel):
    active_power: float
    voltage: float
    current: float
    frequency: Optional[float] = 50.0
    energy_consumed_kwh: float
    grid_status: Optional[str] = "grid"

class EnergyMetricCreate(EnergyMetricBase):
    timestamp: Optional[datetime] = None

class EnergyMetricResponse(EnergyMetricBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True

# Appliance Schemas
class ApplianceMetricBase(BaseModel):
    appliance_name: str
    power_consumed: float
    status: bool
    efficiency_grade: Optional[str] = "A"

class ApplianceMetricCreate(ApplianceMetricBase):
    timestamp: Optional[datetime] = None

class ApplianceMetricResponse(ApplianceMetricBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True

class ApplianceToggle(BaseModel):
    status: bool

# Solar Schemas
class SolarForecastBase(BaseModel):
    timestamp: datetime
    predicted_generation: float
    weather_condition: str
    solar_irradiance: float

class SolarForecastResponse(SolarForecastBase):
    id: int

    class Config:
        from_attributes = True

# Cost Recommendations Schemas
class CostRecommendationBase(BaseModel):
    title: str
    recommendation_text: str
    potential_saving: float
    status: str
    actionable_type: str

class CostRecommendationUpdate(BaseModel):
    status: str

class CostRecommendationResponse(CostRecommendationBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True

# Aggregated Dashboard Stats
class DashboardStats(BaseModel):
    current_load_kw: float
    today_consumption_kwh: float
    today_solar_generation_kwh: float
    current_solar_production_kw: float
    battery_soc_percent: float
    battery_charging_rate_kw: float
    today_cost_estimate: float
    grid_dependence_percent: float
    savings_this_month: float
    co2_saved_kg: float
