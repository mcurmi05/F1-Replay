import os
import threading

import fastf1
import pandas as pd

CACHE_DIR = os.environ.get("FASTF1_CACHE_DIR", ".fastf1_cache")
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

_load_lock = threading.Lock()


def _iso(value):
    if value is None or pd.isna(value):
        return None
    return pd.Timestamp(value).isoformat()


def _seconds(value):
    if value is None or pd.isna(value):
        return None
    return pd.Timedelta(value).total_seconds()


def _int(value):
    if value is None or pd.isna(value):
        return None
    return int(value)


def _float(value):
    if value is None or pd.isna(value):
        return None
    return float(value)


def _text(value):
    if value is None:
        return None
    if not isinstance(value, str) and pd.isna(value):
        return None
    return str(value)


def get_schedule(year):
    schedule = fastf1.get_event_schedule(year, include_testing=False)
    events = []
    for _, row in schedule.iterrows():
        events.append({
            "round": _int(row.get("RoundNumber")),
            "country": _text(row.get("Country")),
            "location": _text(row.get("Location")),
            "event_name": _text(row.get("EventName")),
            "event_date": _iso(row.get("EventDate")),
        })
    return events


def load_session(year, event, session_type):
    gp = int(event) if str(event).isdigit() else event
    with _load_lock:
        session = fastf1.get_session(year, gp, session_type)
        session.load(laps=True, telemetry=True, weather=True, messages=True)
    return session


def session_summary(session):
    event = session.event
    return {
        "event_name": _text(event.get("EventName")),
        "country": _text(event.get("Country")),
        "location": _text(event.get("Location")),
        "session_name": _text(session.name),
        "date": _iso(session.date),
        "drivers": [str(number) for number in session.drivers],
    }


def results(session):
    rows = []
    for _, row in session.results.iterrows():
        rows.append({
            "driver_number": _text(row.get("DriverNumber")),
            "abbreviation": _text(row.get("Abbreviation")),
            "full_name": _text(row.get("FullName")),
            "team_name": _text(row.get("TeamName")),
            "team_colour": _text(row.get("TeamColor")),
            "position": _int(row.get("Position")),
            "grid_position": _int(row.get("GridPosition")),
            "points": _float(row.get("Points")),
            "status": _text(row.get("Status")),
            "time": _seconds(row.get("Time")),
        })
    return rows


def laps(session, driver=None):
    table = session.laps
    if driver is not None:
        table = table.pick_drivers(driver)
    rows = []
    for _, lap in table.iterrows():
        rows.append({
            "driver_number": _text(lap.get("DriverNumber")),
            "lap_number": _int(lap.get("LapNumber")),
            "lap_time": _seconds(lap.get("LapTime")),
            "sector_1": _seconds(lap.get("Sector1Time")),
            "sector_2": _seconds(lap.get("Sector2Time")),
            "sector_3": _seconds(lap.get("Sector3Time")),
            "compound": _text(lap.get("Compound")),
            "tyre_life": _float(lap.get("TyreLife")),
            "stint": _int(lap.get("Stint")),
        })
    return rows


def driver_telemetry(session, driver):
    driver_laps = session.laps.pick_drivers(driver)
    telemetry = driver_laps.get_telemetry().add_distance()
    rows = []
    for _, point in telemetry.iterrows():
        brake = point.get("Brake")
        rows.append({
            "time": _seconds(point.get("Time")),
            "distance": _float(point.get("Distance")),
            "speed": _float(point.get("Speed")),
            "throttle": _float(point.get("Throttle")),
            "brake": bool(brake) if pd.notna(brake) else None,
            "gear": _int(point.get("nGear")),
            "rpm": _float(point.get("RPM")),
            "drs": _int(point.get("DRS")),
            "x": _float(point.get("X")),
            "y": _float(point.get("Y")),
        })
    return rows
