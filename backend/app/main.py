from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db import engine, Base
from app.routers import auth, energy

# Initialize Database tables and ML models
try:
    Base.metadata.create_all(bind=engine)
    
    # Run TimescaleDB hypertable setups
    from app.timescale_setup import setup_timescaledb
    setup_timescaledb()
    
    # Initial AI model training run so pickle exists
    from app.db import SessionLocal
    from app.forecaster import train_energy_model
    from app.nilm_model import train_nilm_models
    db = SessionLocal()
    try:
        train_energy_model(db)
        train_nilm_models()
    except Exception as err:
        print(f"Model training initialization warning: {err}")
    finally:
        db.close()
except Exception as e:
    print(f"Error initializing database or models: {e}. Check your configuration.")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start Smart Meter simulator background loop
    from app.simulator import start_simulator_task
    start_simulator_task()
    yield
    # Shutdown: Stop simulator background loop
    from app.simulator import stop_simulator_task
    stop_simulator_task()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Full-stack Intelligent Energy Monitoring & Optimization System",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# CORS configuration
# Allowing frontend local configurations to query the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(energy.router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "api_docs": "/docs",
        "api_version": "v1"
    }
