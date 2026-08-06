from sqlalchemy import text
from app.db import engine, db_url

def setup_timescaledb():
    # Detect if we are running on standard PostgreSQL
    if not db_url.startswith("postgresql"):
        print("[INFO] Database driver is not PostgreSQL/TimescaleDB. Skipping TimescaleDB hypertable setups.")
        return False

    print("[START] PostgreSQL detected. Initializing TimescaleDB hypertable conversions...")
    try:
        with engine.connect() as conn:
            # 1. Enable TimescaleDB extension
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"))
            conn.commit()
            print("[SUCCESS] TimescaleDB extension enabled.")

            # 2. Check and create hypertables
            # TimescaleDB requires 'create_hypertable' function. We handle if_not_exists safely.
            try:
                conn.execute(text("SELECT create_hypertable('energy_metrics', 'timestamp', if_not_exists => TRUE);"))
                conn.commit()
                print("[SUCCESS] Table 'energy_metrics' converted to TimescaleDB Hypertable.")
            except Exception as e:
                # If table already has data, sometimes we need migrate_data => true or it might throw
                if "already a hypertable" in str(e).lower():
                    print("[INFO] Table 'energy_metrics' is already a hypertable.")
                else:
                    try:
                        conn.execute(text("SELECT create_hypertable('energy_metrics', 'timestamp', migrate_data => TRUE);"))
                        conn.commit()
                        print("[SUCCESS] Table 'energy_metrics' converted to Hypertable (data migrated).")
                    except Exception as ex:
                        print(f"[WARNING] Error converting 'energy_metrics' to hypertable: {ex}")

            try:
                conn.execute(text("SELECT create_hypertable('appliance_metrics', 'timestamp', if_not_exists => TRUE);"))
                conn.commit()
                print("[SUCCESS] Table 'appliance_metrics' converted to TimescaleDB Hypertable.")
            except Exception as e:
                if "already a hypertable" in str(e).lower():
                    print("[INFO] Table 'appliance_metrics' is already a hypertable.")
                else:
                    try:
                        conn.execute(text("SELECT create_hypertable('appliance_metrics', 'timestamp', migrate_data => TRUE);"))
                        conn.commit()
                        print("[SUCCESS] Table 'appliance_metrics' converted to Hypertable (data migrated).")
                    except Exception as ex:
                        print(f"[WARNING] Error converting 'appliance_metrics' to hypertable: {ex}")

            print("[FINISHED] TimescaleDB migrations finalized successfully!")
            return True
            
    except Exception as e:
        print(f"[ERROR] Failed to run TimescaleDB migrations: {e}")
        return False

if __name__ == "__main__":
    setup_timescaledb()
