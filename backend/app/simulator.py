import asyncio
import datetime
import random
from typing import List
from fastapi import WebSocket
from app.db import SessionLocal
from app.models import EnergyMetric, ApplianceMetric

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Connection might have died, handle cleanup safely
                pass

manager = ConnectionManager()

# Battery simulation state
battery_soc = 68.0
battery_target_soc = 90.0
battery_charging_active = False
battery_charge_rate_kw = 0.0

def set_battery_charge(target_soc: float, charge_active: bool):
    global battery_target_soc, battery_charging_active
    battery_target_soc = target_soc
    battery_charging_active = charge_active

# Background task cancellation handle
simulator_task = None
is_running = False

async def run_smart_meter_simulator():
    global is_running, battery_soc, battery_target_soc, battery_charging_active, battery_charge_rate_kw
    is_running = True
    print("[SIMULATOR] Starting Smart Meter Simulator async task...")
    
    # Initialize energy counter from database or a baseline value
    db = SessionLocal()
    try:
        last_metric = db.query(EnergyMetric).order_by(EnergyMetric.timestamp.desc()).first()
        cumulative_energy = last_metric.energy_consumed_kwh if last_metric else 125.40
    finally:
        db.close()

    while is_running:
        try:
            # 1. Query active load from database
            db = SessionLocal()
            active_power = 0.0
            try:
                active_apps = db.query(ApplianceMetric).filter(ApplianceMetric.status == True).all()
                active_power = sum(app.power_consumed for app in active_apps)
            except Exception as e:
                print(f"[SIMULATOR] Error querying database: {e}")
            finally:
                db.close()

            # Default load if nothing is running
            if active_power == 0:
                active_power = 0.45  # baseline standby load (router, fridge idle, etc.)
                
            # Simulated natural solar power for current hour
            now_hour = datetime.datetime.utcnow().hour
            curr_solar = 0.0
            if 6 <= now_hour <= 18:
                # curve peaking around 12 PM
                import math
                bell = math.exp(-0.5 * ((now_hour - 12) / 2.5) ** 2)
                curr_solar = bell * 4.2

            # Dynamic battery charging load
            if battery_charging_active:
                if battery_soc < battery_target_soc:
                    battery_charge_rate_kw = 3.0
                    # Rise by 0.5% per second to make it fast and responsive in simulation
                    battery_soc = min(battery_target_soc, battery_soc + 0.5)
                    active_power += battery_charge_rate_kw
                else:
                    battery_charging_active = False
                    battery_charge_rate_kw = 0.0
            else:
                battery_charge_rate_kw = 0.0
                # Natural slow discharge/charge logic if not overriding
                if curr_solar > active_power:
                    battery_soc = min(100.0, battery_soc + 0.05)
                else:
                    battery_soc = max(15.0, battery_soc - 0.02)

            # Add small random fluctuations (noise)
            active_power = max(0.1, active_power + random.uniform(-0.08, 0.08))
            
            # 2. Simulate other electrical properties
            voltage = random.uniform(228.5, 232.5)
            power_factor = random.uniform(0.92, 0.99)
            
            # Calculate current (Amps) = (Power in Watts) / (Voltage * Power Factor)
            current = (active_power * 1000.0) / (voltage * power_factor)
            
            frequency = random.uniform(49.93, 50.07)
            timestamp = datetime.datetime.utcnow()

            # Integrate energy consumed: Power (kW) * 1 second / 3600 seconds-in-hour
            energy_delta = active_power / 3600.0
            cumulative_energy += energy_delta

            # 2.5 Run NILM disaggregation predictions
            from app.nilm_model import predict_disaggregated_loads
            ai_preds = predict_disaggregated_loads(active_power, timestamp)

            # 3. Formulate payload
            payload = {
                "timestamp": timestamp.isoformat() + "Z",
                "active_power": round(active_power, 3),
                "voltage": round(voltage, 1),
                "current": round(current, 2),
                "frequency": round(frequency, 2),
                "power_factor": round(power_factor, 2),
                "energy_consumed_kwh": round(cumulative_energy, 4),
                "grid_status": "grid" if active_power > 1.2 else "solar",
                "ai_predictions": ai_preds,
                # Dynamic Battery Stats
                "battery_soc": round(battery_soc, 2),
                "battery_charge_rate_kw": round(battery_charge_rate_kw, 2),
                "battery_charging_active": battery_charging_active,
                "battery_target_soc": round(battery_target_soc, 2)
            }

            # 4. Stream payload to all active WebSocket sessions
            await manager.broadcast(payload)

            # 5. Write to DB on every second
            db = SessionLocal()
            try:
                new_metric = EnergyMetric(
                    timestamp=timestamp,
                    active_power=round(active_power, 3),
                    voltage=round(voltage, 1),
                    current=round(current, 2),
                    frequency=round(frequency, 2),
                    energy_consumed_kwh=round(cumulative_energy, 4),
                    grid_status="grid" if active_power > 1.2 else "solar"
                )
                db.add(new_metric)
                db.commit()
            except Exception as e:
                print(f"[SIMULATOR] Error writing metrics to database: {e}")
            finally:
                db.close()

        except Exception as ex:
            print(f"[SIMULATOR] Exception in simulator loop: {ex}")
            
        await asyncio.sleep(1.0)

def start_simulator_task():
    global simulator_task, is_running
    if not is_running:
        is_running = True
        simulator_task = asyncio.create_task(run_smart_meter_simulator())

def stop_simulator_task():
    global simulator_task, is_running
    is_running = False
    if simulator_task:
        simulator_task.cancel()
        print("[SIMULATOR] Smart Meter Simulator task stopped.")
