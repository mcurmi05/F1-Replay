import logging
import os
import threading
import time

import fastf1
import numpy as np
import pandas as pd
from fastf1.exceptions import RateLimitExceededError

_SUPPRESSED_FASTF1_WARNINGS = ("lap accuracy check", "Lap timing integrity check")


def _fastf1_log_filter(record):
    message = record.getMessage()
    return not any(text in message for text in _SUPPRESSED_FASTF1_WARNINGS)


for _handler in logging.getLogger("fastf1").handlers:
    _handler.addFilter(_fastf1_log_filter)

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


def _fetch_schedule(year, attempts=3, delay=0.75):
    last_exc = None
    for attempt in range(attempts):
        try:
            return fastf1.get_event_schedule(year, include_testing=False)
        except RateLimitExceededError:
            raise
        except Exception as exc:
            last_exc = exc
            if attempt < attempts - 1:
                time.sleep(delay)
    raise last_exc


def get_schedule(year):
    schedule = _fetch_schedule(year)
    events = []
    for _, row in schedule.iterrows():
        sessions = []
        for i in range(1, 6):
            name = _text(row.get(f"Session{i}"))
            if name:
                sessions.append({
                    "name": name,
                    "date_utc": _iso(row.get(f"Session{i}DateUtc")),
                    "date_local": _iso(row.get(f"Session{i}Date")),
                })
        session_dates = [s["date_utc"] for s in sessions if s["date_utc"]]
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


def _session_start(session):
    starts = []
    for number in session.drivers:
        pos = session.pos_data.get(number)
        if pos is None or len(pos) == 0:
            continue
        starts.append(_seconds_axis(pos)[0])
    return float(min(starts)) if starts else 0.0


def driver_telemetry(session, driver):
    driver_laps = session.laps.pick_drivers(driver)
    telemetry = driver_laps.get_car_data().add_distance()
    start = _session_start(session)
    rows = []
    for _, point in telemetry.iterrows():
        brake = point.get("Brake")
        rows.append({
            "time": _seconds_rel(point.get("SessionTime"), start),
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


def _parse_gap(value):
    if not isinstance(value, str):
        return float("nan")
    try:
        return float(value)
    except ValueError:
        return float("nan")


def _grid_gap(grid, times, values, ndigits=3, max_hole=30.0):
    mask = ~np.isnan(values)
    if mask.sum() < 1:
        return [None] * len(grid)
    order = np.argsort(times[mask])
    t = times[mask][order]
    v = values[mask][order]
    idx = np.searchsorted(t, grid, side="right") - 1
    out = []
    for gi, point in zip(idx, grid):
        if gi < 0 or point - t[gi] > max_hole:
            out.append(None)
        else:
            out.append(round(float(v[gi]), ndigits))
    return out


class ReplayTimingError(Exception):
    pass


def _timing_streams(session):
    try:
        import fastf1._api as ff1_api

        _, stream = ff1_api.timing_data(session.api_path)
        if stream is None or len(stream) == 0:
            raise ReplayTimingError("FastF1 returned no timing data for this session")
        streams = {}
        for number, group in stream.groupby("Driver"):
            times = group["Time"].dt.total_seconds().to_numpy()
            position = group["Position"].to_numpy(dtype=float)
            leader = group["GapToLeader"].map(_parse_gap).to_numpy(dtype=float)
            interval = group["IntervalToPositionAhead"].map(_parse_gap).to_numpy(dtype=float)
            streams[str(number)] = (times, position, leader, interval)
        return streams
    except ReplayTimingError:
        raise
    except Exception as exc:
        raise ReplayTimingError(f"FastF1 timing API failed: {exc}") from exc


def _race_control_messages(session, first_sample_time_offset):
    try:
        import fastf1._api as ff1_api

        msgs = ff1_api.race_control_messages(session.api_path)
        if not msgs or len(msgs.get("Time", [])) == 0:
            return []

        times = msgs.get("Time", [])
        if not times or len(times) == 0:
            return []

        first_msg_ts = None
        if hasattr(times[0], "timestamp"):
            try:
                first_msg_ts = times[0].timestamp()
            except (TypeError, AttributeError):
                pass

        result = []
        for i, t in enumerate(msgs["Time"]):
            msg_time = None
            if hasattr(t, "timestamp") and first_msg_ts is not None:
                try:
                    msg_time = round(t.timestamp() - first_msg_ts + first_sample_time_offset, 1)
                except (TypeError, AttributeError):
                    pass

            msg = {
                "time": msg_time,
                "category": _text(msgs["Category"][i]),
                "message": _text(msgs["Message"][i]),
                "status": _text(msgs["Status"][i]),
                "flag": _text(msgs["Flag"][i]),
            }
            result.append(msg)
        return result
    except Exception:
        return []


def _weather_series(session, start):
    try:
        weather = session.weather_data
    except Exception:
        return []
    if weather is None or len(weather) == 0:
        return []
    series = []
    for _, row in weather.iterrows():
        sample_time = row.get("Time")
        if sample_time is None or pd.isna(sample_time):
            continue
        rainfall = row.get("Rainfall")
        series.append({
            "time": round(float(pd.Timedelta(sample_time).total_seconds()) - start, 2),
            "air_temp": _float(row.get("AirTemp")),
            "track_temp": _float(row.get("TrackTemp")),
            "humidity": _float(row.get("Humidity")),
            "pressure": _float(row.get("Pressure")),
            "wind_speed": _float(row.get("WindSpeed")),
            "wind_direction": _int(row.get("WindDirection")),
            "rainfall": bool(rainfall) if pd.notna(rainfall) else False,
        })
    return series


def _qualifying_segments(session, start):
    quali_like = getattr(session, "_QUALI_LIKE_SESSIONS", ())
    if session.name not in quali_like:
        return []
    status = session.session_status
    if status is None or len(status) == 0:
        return []
    try:
        ranges = []
        pending = None
        for _, row in status.iterrows():
            state = row.get("Status")
            if state == "Started":
                if pending is None:
                    pending = row.get("Time")
            elif state == "Finished":
                if pending is not None:
                    ranges.append((pending, row.get("Time")))
                    pending = None
        if pending is not None:
            ranges.append((pending, status["Time"].iloc[-1]))
    except Exception:
        return []

    if not ranges:
        return []

    prefix = "SQ" if "Sprint" in (session.name or "") else "Q"
    segments = []
    for i, (seg_start, seg_end) in enumerate(ranges[:3]):
        segments.append({
            "name": f"{prefix}{i + 1}",
            "start": round(float(pd.Timedelta(seg_start).total_seconds()) - start, 2),
            "end": round(float(pd.Timedelta(seg_end).total_seconds()) - start, 2),
        })
    return segments


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
            "track_status": [],
            "total_laps": None,
            "time": [],
            "track": {"x": [], "y": []},
            "corners": [],
            "bounds": {},
            "drivers": [],
            "positions": {},
            "laps": {},
            "weather": [],
            "qualifying_segments": [],
        }

    start = float(min(starts))
    end = float(max(ends))
    grid = np.arange(start, end, step)

    streams = _timing_streams(session)

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
        stream = streams.get(str(number))
        if stream is not None:
            gtimes, gposition, gleader, ginterval = stream
            entry["position"] = _grid_gap(grid, gtimes, gposition, ndigits=0, max_hole=float("inf"))
            entry["gap_leader"] = _grid_gap(grid, gtimes, gleader)
            entry["interval"] = _grid_gap(grid, gtimes, ginterval)
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

    track_status = []
    ts = session.track_status
    if ts is not None and len(ts):
        for _, row in ts.iterrows():
            code = _text(row.get("Status"))
            if code is None:
                continue
            track_status.append({
                "start": round(float(pd.Timedelta(row.get("Time")).total_seconds()) - start, 2),
                "code": code,
                "message": _text(row.get("Message")),
            })

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
                "pit_in": _seconds_rel(pit_in if pd.notna(pit_in) else None, start),
                "pit_out": _seconds_rel(pit_out if pd.notna(pit_out) else None, start),
                "start": _seconds_rel(lap.get("LapStartTime"), start),
                "lap_time": _seconds(lap.get("LapTime")),
            })
        laps_by_driver[number] = entries

    race_control = _race_control_messages(session, start)
    weather = _weather_series(session, start)
    qualifying_segments = _qualifying_segments(session, start)

    return {
        "available": True,
        "step": step,
        "duration": end - start,
        "race_start": race_start,
        "track_status": track_status,
        "total_laps": _int(getattr(session, "total_laps", None)),
        "time": [round(float(t - start), 2) for t in grid],
        "track": track,
        "corners": corners,
        "bounds": bounds,
        "drivers": drivers,
        "positions": positions,
        "laps": laps_by_driver,
        "race_control_messages": race_control,
        "weather": weather,
        "qualifying_segments": qualifying_segments,
    }
