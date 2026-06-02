import os
import threading

import fastf1
import numpy as np
import pandas as pd

_load_lock = threading.Lock()
_cache_dir = None
_cache_deleted = False

CACHE_FOLDER_NAME = "f1replaycache"


def set_cache(directory):
    global _cache_dir, _cache_deleted
    if os.path.basename(os.path.normpath(directory)) == CACHE_FOLDER_NAME:
        target = directory
    else:
        target = os.path.join(directory, CACHE_FOLDER_NAME)
    os.makedirs(target, exist_ok=True)
    fastf1.Cache.enable_cache(target)
    _cache_dir = target
    _cache_deleted = False


def get_cache():
    return _cache_dir


def cache_valid():
    global _cache_dir, _cache_deleted
    if _cache_dir is None:
        return False
    if not os.path.isdir(_cache_dir):
        _cache_dir = None
        _cache_deleted = True
        return False
    return True


def cache_was_deleted():
    return _cache_deleted


_env_cache = os.environ.get("FASTF1_CACHE_DIR")
if _env_cache:
    set_cache(_env_cache)


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
        sessions = []
        for i in range(1, 6):
            name = _text(row.get(f"Session{i}"))
            if name:
                sessions.append(name)
        session_dates = [
            _iso(row.get(f"Session{i}DateUtc"))
            for i in range(1, 6)
            if _iso(row.get(f"Session{i}DateUtc")) is not None
        ]
        events.append({
            "round": _int(row.get("RoundNumber")),
            "country": _text(row.get("Country")),
            "location": _text(row.get("Location")),
            "event_name": _text(row.get("EventName")),
            "event_date": _iso(row.get("EventDate")),
            "date_start": session_dates[0] if session_dates else None,
            "date_end": session_dates[-1] if session_dates else None,
            "sessions": sessions,
        })
    return events


def is_session_cached(year, event, session_type):
    try:
        gp = int(event) if str(event).isdigit() else event
        session = fastf1.get_session(year, gp, session_type)
        rel = session.api_path.lstrip("/")
        if rel.startswith("static/"):
            rel = rel[len("static/"):]
        cache_subdir = os.path.join(_cache_dir, rel)
        if not os.path.isdir(cache_subdir):
            return False
        return any(f.endswith(".ff1pkl") for f in os.listdir(cache_subdir))
    except Exception:
        return False


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


def _seconds_axis(frame):
    return frame["SessionTime"].dt.total_seconds().to_numpy()


def _seconds_rel(value, origin):
    if value is None or pd.isna(value):
        return None
    return round(pd.Timedelta(value).total_seconds() - origin, 2)


def _grid_values(grid, times, values, ndigits=0):
    interpolated = np.interp(grid, times, values, left=np.nan, right=np.nan)
    rounded = np.round(interpolated, ndigits)
    out = []
    for value in rounded:
        if np.isnan(value):
            out.append(None)
        elif ndigits <= 0:
            out.append(int(value))
        else:
            out.append(float(value))
    return out


def build_replay(session, step=0.5):
    results_by_number = {
        str(row.get("DriverNumber")): row for _, row in session.results.iterrows()
    }

    samples = {}
    starts = []
    ends = []
    for number in session.drivers:
        pos = session.pos_data.get(number)
        if pos is None or len(pos) == 0:
            continue
        times = _seconds_axis(pos)
        samples[number] = (times, pos)
        starts.append(times[0])
        ends.append(times[-1])

    if not samples:
        return {
            "available": False,
            "step": step,
            "duration": 0.0,
            "race_start": None,
            "total_laps": None,
            "time": [],
            "track": {"x": [], "y": []},
            "corners": [],
            "bounds": {},
            "drivers": [],
            "positions": {},
            "laps": {},
        }

    start = float(min(starts))
    end = float(max(ends))
    grid = np.arange(start, end, step)

    positions = {}
    drivers = []
    for number, (times, pos) in samples.items():
        entry = {
            "x": _grid_values(grid, times, pos["X"].to_numpy()),
            "y": _grid_values(grid, times, pos["Y"].to_numpy()),
        }
        car = session.car_data.get(number)
        if car is not None and len(car):
            car_times = _seconds_axis(car)
            entry["speed"] = _grid_values(grid, car_times, car["Speed"].to_numpy())
            entry["throttle"] = _grid_values(grid, car_times, car["Throttle"].to_numpy())
            entry["brake"] = _grid_values(grid, car_times, car["Brake"].astype(float).to_numpy())
            entry["gear"] = _grid_values(grid, car_times, car["nGear"].to_numpy())
        positions[number] = entry

        row = results_by_number.get(number)
        drivers.append({
            "number": number,
            "abbreviation": _text(row.get("Abbreviation")) if row is not None else None,
            "full_name": _text(row.get("FullName")) if row is not None else None,
            "team_name": _text(row.get("TeamName")) if row is not None else None,
            "team_colour": _text(row.get("TeamColor")) if row is not None else None,
        })

    lap_tel = session.laps.pick_fastest().get_telemetry()
    tx = lap_tel["X"].to_numpy()
    ty = lap_tel["Y"].to_numpy()
    mask = ~(np.isnan(tx) | np.isnan(ty))
    track = {
        "x": [int(round(v)) for v in tx[mask]],
        "y": [int(round(v)) for v in ty[mask]],
    }

    corners = []
    info = session.get_circuit_info()
    if info is not None:
        for _, corner in info.corners.iterrows():
            corners.append({
                "number": _int(corner.get("Number")),
                "x": _float(corner.get("X")),
                "y": _float(corner.get("Y")),
            })

    xs = track["x"] + [c["x"] for c in corners if c["x"] is not None]
    ys = track["y"] + [c["y"] for c in corners if c["y"] is not None]
    bounds = {
        "min_x": min(xs),
        "max_x": max(xs),
        "min_y": min(ys),
        "max_y": max(ys),
    }

    race_start = None
    status = session.session_status
    if status is not None and len(status):
        started = status[status["Status"] == "Started"]
        if len(started):
            race_start = round(float(started.iloc[0]["Time"].total_seconds()) - start, 2)

    laps_by_driver = {}
    for number in samples:
        entries = []
        for _, lap in session.laps.pick_drivers(number).iterrows():
            pit_in = lap.get("PitInTime")
            pit_out = lap.get("PitOutTime")
            entries.append({
                "lap": _int(lap.get("LapNumber")),
                "position": _int(lap.get("Position")),
                "compound": _text(lap.get("Compound")),
                "tyre_age": _int(lap.get("TyreLife")),
                "stint": _int(lap.get("Stint")),
                "pitted": bool(pd.notna(pit_in) or pd.notna(pit_out)),
                "start": _seconds_rel(lap.get("LapStartTime"), start),
            })
        laps_by_driver[number] = entries

    return {
        "available": True,
        "step": step,
        "duration": end - start,
        "race_start": race_start,
        "total_laps": _int(getattr(session, "total_laps", None)),
        "time": [round(float(t - start), 2) for t in grid],
        "track": track,
        "corners": corners,
        "bounds": bounds,
        "drivers": drivers,
        "positions": positions,
        "laps": laps_by_driver,
    }
