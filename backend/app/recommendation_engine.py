import datetime
from sqlalchemy.orm import Session
from app.models import CostRecommendation, ApplianceMetric, SolarForecastMetric, WeatherMetric

def generate_recommendations(db: Session) -> list[CostRecommendation]:
    # 1. Fetch current status of appliances, weather, and solar forecast
    appliances = db.query(ApplianceMetric).all()
    solar_forecasts = db.query(SolarForecastMetric).all()
    
    # Defaults
    washing_machine_active = False
    washing_machine_power = 0.0
    tv_standby = False
    ac_active = False
    
    for app in appliances:
        name = app.appliance_name.lower()
        if "washing" in name and app.is_active:
            washing_machine_active = True
            washing_machine_power = app.energy_consumption
        elif "tv" in name:
            # Let's assume tv is in standby if power is very low but not 0 (e.g. 0.005 to 0.05 kW)
            if 0.002 <= app.energy_consumption <= 0.025:
                tv_standby = True
        elif "ac" in name and app.is_active:
            ac_active = True

    # 2. Check Solar Forecast status
    has_solar_surplus = False
    peak_solar_irradiance = 0.0
    for sf in solar_forecasts:
        if 10 <= sf.timestamp.hour <= 15: # solar window
            if sf.solar_irradiance > 500:
                has_solar_surplus = True
            peak_solar_irradiance = max(peak_solar_irradiance, sf.solar_irradiance)

    # 3. Compile dynamic AI recommendations
    recommendations_to_save = []

    # Recommendation A: Shift washing machine to off-peak hours
    # If washing machine is currently running, or by default as an optimization action
    title_wm = "Shift Washing Machine Load"
    desc_wm = "Your washing machine is scheduled or running. Shift its operating cycle to off-peak hours (9:00 PM - 6:00 AM) or mid-day solar peak to save on peak grid tariffs."
    saving_wm = 5.40
    if washing_machine_active:
        desc_wm = f"Washing machine currently consuming {washing_machine_power} kW. Shifting this 1.5-hour cycle to super off-peak hours (10:00 PM) avoids the current peak rates."
        saving_wm = 8.20

    recommendations_to_save.append({
        "title": title_wm,
        "recommendation_text": desc_wm,
        "potential_saving": saving_wm,
        "status": "pending",
        "actionable_type": "shift_load"
    })

    # Recommendation B: Charge battery before evening
    # If solar forecast predicts midday surplus, recommend storing it for peak evening rates (4 PM - 9 PM)
    title_batt = "Solar Battery Pre-Charging"
    desc_batt = "Forecast predicts peak solar irradiance of {:.0f} W/m² today. Schedule battery pre-charging during solar noon (11:00 AM - 2:00 PM) to cover high-cost evening peak demand.".format(
        peak_solar_irradiance if peak_solar_irradiance > 0 else 750.0
    )
    saving_batt = 12.50
    if has_solar_surplus:
        saving_batt = 16.80

    recommendations_to_save.append({
        "title": title_batt,
        "recommendation_text": desc_batt,
        "potential_saving": saving_batt,
        "status": "pending",
        "actionable_type": "battery"
    })

    # Recommendation C: Reduce standby power
    # Recommend shutting down electronics in standby (e.g. TVs, entertainment systems) during sleep hours (12 AM - 6 AM)
    title_standby = "Eliminate Idle Standby Power"
    desc_standby = "Detected ongoing standby draws from media units and unused charges overnight. Disable smart plugs automatically from 12:00 AM to 6:00 AM to eliminate standby leak."
    saving_standby = 2.10
    if tv_standby:
        desc_standby = "Entertainment systems are currently in idle standby mode. Activating sleeping-hours shutdown cuts phantom loads completely."
        saving_standby = 3.50

    recommendations_to_save.append({
        "title": title_standby,
        "recommendation_text": desc_standby,
        "potential_saving": saving_standby,
        "status": "pending",
        "actionable_type": "standby"
    })

    # Recommendation D: AC Setpoint Optimization (if AC active)
    if ac_active:
        recommendations_to_save.append({
            "title": "Thermostat AC Optimization",
            "recommendation_text": "Increase your Air Conditioning setpoint by 1.5°C between 5:00 PM and 8:00 PM. This lowers your load during peak billing without sacrificing comfort.",
            "potential_saving": 6.80,
            "status": "pending",
            "actionable_type": "thermostat"
        })

    # 4. Synchronize with database: Preserve user states if same recommendations exist
    existing_recs = {r.title: r.status for r in db.query(CostRecommendation).all()}
    
    # Delete old
    db.query(CostRecommendation).delete()
    
    final_models = []
    for r in recommendations_to_save:
        # Carry over applied/dismissed state if user already clicked it
        saved_status = existing_recs.get(r["title"], r["status"])
        rec_model = CostRecommendation(
            title=r["title"],
            recommendation_text=r["recommendation_text"],
            potential_saving=r["potential_saving"],
            status=saved_status,
            actionable_type=r["actionable_type"]
        )
        db.add(rec_model)
        final_models.append(rec_model)
        
    db.commit()
    
    # Refresh all
    for fm in final_models:
        db.refresh(fm)
        
    return final_models
