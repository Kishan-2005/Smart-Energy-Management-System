import datetime
from sqlalchemy.orm import Session
from app.models import CostRecommendation, ApplianceMetric, SolarForecastMetric, WeatherMetric


def generate_recommendations(db: Session) -> list[CostRecommendation]:
    # Fetch latest appliance, solar forecast, and weather data
    appliances = db.query(ApplianceMetric).all()
    solar_forecasts = db.query(SolarForecastMetric).all()
    weather_records = db.query(WeatherMetric).order_by(WeatherMetric.timestamp.desc()).limit(6).all()

    now = datetime.datetime.utcnow()
    washing_machine_active = False
    washing_machine_power = 0.0
    standby_draw = 0.0
    tv_standby = False
    ac_active = False
    battery_present = True
    has_washing_machine = False

    for app in appliances:
        name = (app.appliance_name or '').lower()
        power = float(app.power_consumed or 0.0)

        if "washing" in name:
            has_washing_machine = True
            if app.status or power > 0.05:
                washing_machine_active = True
                washing_machine_power = power

        if "tv" in name or "entertainment" in name or "media" in name:
            if app.status and 0.0 < power <= 0.15:
                tv_standby = True
                standby_draw += power

        if "ac" in name or "air conditioner" in name or "temperature" in name:
            if app.status:
                ac_active = True

        if "battery" in name or "storage" in name or "inverter" in name:
            battery_present = True

    today_forecasts = [sf for sf in solar_forecasts if sf.timestamp.date() == now.date()]
    peak_solar_irradiance = max((sf.solar_irradiance for sf in today_forecasts if 9 <= sf.timestamp.hour <= 15), default=0.0)
    has_solar_surplus = peak_solar_irradiance >= 500
    mid_day_charge_window = "11:00 AM - 2:00 PM" if has_solar_surplus else "2:00 AM - 6:00 AM"

    recent_weather = weather_records[0].condition if weather_records else "Clear"

    recommendations_to_save = []

    # Recommendation A: Shift washing machine to off-peak hours
    if has_washing_machine:
        title_wm = "Shift Washing Machine to Off-Peak"
        if washing_machine_active:
            desc_wm = (
                f"The washing machine is currently running at {washing_machine_power:.2f} kW. "
                "Shift the remaining cycle to 9:00 PM - 6:00 AM when rates are lowest, or to mid-day solar peak if you have enough rooftop generation."
            )
            saving_wm = 9.20
        else:
            desc_wm = (
                "Schedule your next washing load for off-peak hours (9:00 PM - 6:00 AM) or mid-day solar peak. "
                "This avoids evening grid peak pricing and reduces your home energy bill."
            )
            saving_wm = 6.10

        recommendations_to_save.append({
            "title": title_wm,
            "recommendation_text": desc_wm,
            "potential_saving": saving_wm,
            "status": "pending",
            "actionable_type": "shift_load"
        })

    # Recommendation B: Charge battery before evening
    title_batt = "Charge Battery Before Evening Peak"
    if battery_present:
        desc_batt = (
            f"Use {mid_day_charge_window} to charge storage before the evening peak. "
            f"{('Mid-day solar surplus is expected today.' if has_solar_surplus else 'Off-peak grid hours still offer lower cost charging than evening use.') }"
        )
        saving_batt = 14.60 if has_solar_surplus else 10.20
    else:
        desc_batt = (
            "If your home battery is available, pre-charge it before 5:00 PM to keep evening grid demand low. "
            "This is especially useful on days with high solar generation or when evening tariffs spike."
        )
        saving_batt = 10.20

    recommendations_to_save.append({
        "title": title_batt,
        "recommendation_text": desc_batt,
        "potential_saving": saving_batt,
        "status": "pending",
        "actionable_type": "battery"
    })

    # Recommendation C: Reduce standby power
    title_standby = "Reduce Standby Power"
    if tv_standby:
        desc_standby = (
            "Detected low-power standby draws from entertainment or media devices. "
            "Turn off unused equipment and smart plugs between midnight and 6:00 AM to avoid phantom load."
        )
        saving_standby = 4.00
    elif standby_draw > 0:
        desc_standby = (
            "Non-essential devices are drawing a small amount of power while idle. "
            "Disable standby power overnight and let appliances fully power down to save energy."
        )
        saving_standby = 3.10
    else:
        desc_standby = (
            "Review low-power devices in your home for hidden standby consumption. "
            "Smart scheduling can eliminate phantom loads during sleeping hours."
        )
        saving_standby = 2.10

    recommendations_to_save.append({
        "title": title_standby,
        "recommendation_text": desc_standby,
        "potential_saving": saving_standby,
        "status": "pending",
        "actionable_type": "standby"
    })

    # Recommendation D: AC setpoint optimization
    if ac_active:
        recommendations_to_save.append({
            "title": "Pre-Cool and Raise AC Setpoint",
            "recommendation_text": (
                "Pre-cool your home between 2:00 PM and 4:00 PM and raise the thermostat by 1.5°C during evening peak hours. "
                "This reduces the AC load when grid costs are highest."
            ),
            "potential_saving": 7.85,
            "status": "pending",
            "actionable_type": "thermostat"
        })

    # Preserve user state for existing recommendations
    existing_recs = {r.title: r.status for r in db.query(CostRecommendation).all()}
    db.query(CostRecommendation).delete()

    final_models = []
    for r in recommendations_to_save:
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
    for fm in final_models:
        db.refresh(fm)

    return final_models
