import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

db_url = settings.DATABASE_URL
connect_args = {}
fallback_to_sqlite = False

if db_url.startswith("postgresql"):
    try:
        # Attempt to establish connection with a short timeout to prevent startup hangs
        temp_engine = create_engine(
            db_url, 
            connect_args={"connect_timeout": 3}
        )
        with temp_engine.connect() as conn:
            pass
        temp_engine.dispose()
        
        # Connection succeeded
        engine = create_engine(db_url)
        print("[DATABASE] Successfully connected to PostgreSQL!")
    except Exception as e:
        print(f"[DATABASE] WARNING: PostgreSQL connection failed: {e}")
        print("[DATABASE] Automatically falling back to local SQLite database.")
        fallback_to_sqlite = True
else:
    fallback_to_sqlite = True

if fallback_to_sqlite:
    db_url = "sqlite:///./energy_system.db"
    connect_args = {"check_same_thread": False}
    engine = create_engine(db_url, connect_args=connect_args)
    print(f"[DATABASE] SQLite database initialized at: {db_url}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
