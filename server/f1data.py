import json
import logging
import os
import threading
import time

import fastf1
import numpy as np
import pandas as pd
import platformdirs
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

_CONFIG_PATH = os.path.join(platformdirs.user_data_dir("f1-replay", ensure_exists=True), "config.json")


def _save_cache_pref(path):
    try:
        with open(_CONFIG_PATH, "w") as handle:
            json.dump({"cache_dir": path}, handle)
    except OSError:
        pass


def _load_cache_pref():
    try:
        with open(_CONFIG_PATH) as handle:
            return json.load(handle).get("cache_dir")
    except (OSError, ValueError):
        return None

TEAM_COLORS = {
    "mclaren": "FF8000",
    "ferrari": "E80020",
    "red_bull": "3671C6",
    "mercedes": "27F4D2",
    "aston_martin": "229971",
    "alpine": "0093CC",
    "williams": "64C4FF",
    "rb": "6692FF",
    "racing_bulls": "6692FF",
    "alphatauri": "6692FF",
    "haas": "B6BABD",
    "audi": "52E252",
    "sauber": "52E252",
    "kick_sauber": "52E252",
    "cadillac": "D4AF37",
}


_event_colour_cache = {}


def _colours_from_session(year, rnd, ident, skip_name=None):
    try:
        sib = fastf1.get_session(year, rnd, ident)
        if skip_name is not None and getattr(sib, "name", None) == skip_name:
            return {}
        with _load_lock:
            sib.load(laps=False, telemetry=False, weather=False, messages=False)
        colours = {}
        for _, row in sib.results.iterrows():
            tid = _text(row.get("TeamId"))
            tc = _text(row.get("TeamColor"))
            if tid and tc:
                colours.setdefault(tid.lower(), tc)
        return colours
    except Exception:
        return {}


def _event_colour_map(session):
    try:
        year = getattr(session.event, "year", None)
        rnd = session.event.get("RoundNumber")
    except Exception:
        return {}
    if year is None:
        return {}
    if year in _event_colour_cache:
        return _event_colour_cache[year]
    current = getattr(session, "name", None)
    colours = {}
    if rnd is not None:
        for ident in ("R", "Sprint", "Q", "SQ", "FP3", "FP2", "FP1"):
            colours = _colours_from_session(year, rnd, ident, skip_name=current)
            if colours:
                break
    if not colours and rnd is not None:
        for r in range(int(rnd) - 1, 0, -1):
            for ident in ("R", "Sprint", "Q"):
                colours = _colours_from_session(year, r, ident)
                if colours:
                    break
            if colours:
                break
    if colours:
        _event_colour_cache[year] = colours
    return colours


def _driver_colour(row, colour_map=None):
    if row is None:
        return None
    tc = _text(row.get("TeamColor"))
    if tc:
        return tc
    team_id = _text(row.get("TeamId"))
    if not team_id:
        return None
    key = team_id.lower()
    if colour_map and key in colour_map:
        return colour_map[key]
    return TEAM_COLORS.get(key)


_live_driver_meta_cache = {}
_LIVE_META_EMPTY_TTL = 60


def _driver_meta_from_session(year, rnd, ident, skip_name=None):
    try:
        sib = fastf1.get_session(year, rnd, ident)
        if skip_name is not None and getattr(sib, "name", None) == skip_name:
            return {}
        with _load_lock:
            sib.load(laps=False, telemetry=False, weather=False, messages=False)
        meta = {}
        for _, row in sib.results.iterrows():
            number = _text(row.get("DriverNumber"))
            if not number:
                continue
            colour = _driver_colour(row)
            team = _text(row.get("TeamName"))
            if colour or team:
                meta[number] = {"team_name": team or None, "team_colour": colour}
        return meta
    except Exception:
        return {}


def live_driver_meta(year, rnd, skip_name=None):
    if year is None:
        return {}
    cached = _live_driver_meta_cache.get(year)
    if cached is not None:
        meta, stamp = cached
        if meta or (time.time() - stamp) < _LIVE_META_EMPTY_TTL:
            return meta
    meta = {}
    if rnd is not None:
        for ident in ("R", "Sprint", "Q", "SQ", "FP3", "FP2", "FP1"):
            meta = _driver_meta_from_session(year, rnd, ident, skip_name=skip_name)
            if meta:
                break
        if not meta:
            for r in range(int(rnd) - 1, 0, -1):
                for ident in ("R", "Sprint", "Q"):
                    meta = _driver_meta_from_session(year, r, ident)
                    if meta:
                        break
                if meta:
                    break
    _live_driver_meta_cache[year] = (meta, time.time())
    return meta


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
    _save_cache_pref(target)


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
else:
    _saved_cache = _load_cache_pref()
    if _saved_cache and os.path.isdir(_saved_cache):
        try:
            set_cache(_saved_cache)
        except OSError:
            pass


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


_availability_cache = {}
_AVAILABILITY_TTL = 120


def replay_available(year, event, session_type):
    # Only the most recently finished session has uncertain availability; the
    # caller is expected to probe just that one. Result is cached briefly so a
    # picker that asks repeatedly does not hammer the F1 archive.
    key = (year, str(event), str(session_type))
    now = time.time()
    cached = _availability_cache.get(key)
    if cached is not None and now - cached[1] < _AVAILABILITY_TTL:
        return cached[0]
    available = _probe_replay_available(year, event, session_type)
    _availability_cache[key] = (available, now)
    return available


def _probe_replay_available(year, event, session_type):
    if is_session_cached(year, event, session_type):
        return True
    try:
        gp = int(event) if str(event).isdigit() else event
        path = fastf1.get_session(year, gp, session_type).api_path
    except Exception:
        return False
    if not path:
        return False
    try:
        import fastf1._api as ff1_api

        data = ff1_api.fetch_page(path, "session_status")
        return bool(data)
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
    colour_map = None
    for _, row in session.results.iterrows():
        if colour_map is None and not _text(row.get("TeamColor")):
            colour_map = _event_colour_map(session)
        rows.append({
            "driver_number": _text(row.get("DriverNumber")),
            "abbreviation": _text(row.get("Abbreviation")),
            "full_name": _text(row.get("FullName")),
            "team_name": _text(row.get("TeamName")),
            "team_colour": _driver_colour(row, colour_map),
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


def _grid_positions(grid, times, xs, ys, max_hole=5.0):
    # Position feeds park cars at (0, 0) before they start, during dropouts,
    # and after they retire. Interpolating across those points draws a smooth
    # line to the origin, so drop them and blank (None) any grid point that
    # lands in a hole wider than max_hole between real samples. A None x/y is
    # the frontend's signal to hide the car rather than connect across it.
    valid = ~(np.isnan(xs) | np.isnan(ys)) & ~((xs == 0) & (ys == 0))
    if valid.sum() < 2:
        empty = [None] * len(grid)
        return list(empty), list(empty)
    t = times[valid]
    vx = xs[valid]
    vy = ys[valid]
    order = np.argsort(t)
    t, vx, vy = t[order], vx[order], vy[order]
    ix = np.interp(grid, t, vx, left=np.nan, right=np.nan)
    iy = np.interp(grid, t, vy, left=np.nan, right=np.nan)
    idx = np.searchsorted(t, grid, side="right") - 1
    last = len(t) - 1
    out_x = []
    out_y = []
    for gi, gx, gy in zip(idx, ix, iy):
        in_hole = 0 <= gi < last and (t[gi + 1] - t[gi]) > max_hole
        if in_hole or np.isnan(gx) or np.isnan(gy):
            out_x.append(None)
            out_y.append(None)
        else:
            out_x.append(int(round(gx)))
            out_y.append(int(round(gy)))
    return out_x, out_y


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


def _race_control_messages(session, start):
    try:
        import fastf1._api as ff1_api

        msgs = ff1_api.race_control_messages(session.api_path)
        if not msgs or len(msgs.get("Time", [])) == 0:
            return []

        times = msgs.get("Time", [])
        if not times or len(times) == 0:
            return []

        # Convert each message's UTC timestamp to the replay axis via the
        # session's t0 (same anchoring as team radio), so they line up with
        # race_start regardless of when the first message was issued.
        t0 = getattr(session, "t0_date", None)
        if t0 is not None:
            t0 = pd.Timestamp(t0)
            if t0.tzinfo is not None:
                t0 = t0.tz_convert("UTC").tz_localize(None)

        result = []
        for i, t in enumerate(times):
            msg_time = None
            if t0 is not None and t is not None:
                try:
                    ts = pd.Timestamp(t)
                    if ts.tzinfo is not None:
                        ts = ts.tz_convert("UTC").tz_localize(None)
                    msg_time = round((ts - t0).total_seconds() - start, 1)
                except Exception:
                    msg_time = None

            msg = {
                "time": msg_time,
                "category": _text(msgs["Category"][i]),
                "message": _text(msgs["Message"][i]),
                "status": _text(msgs["Status"][i]),
                "flag": _text(msgs["Flag"][i]),
                "scope": _text(msgs.get("Scope", [None] * len(times))[i]),
                "sector": _int(msgs.get("Sector", [None] * len(times))[i]),
                "racing_number": _text(msgs.get("RacingNumber", [None] * len(times))[i]),
                "lap": _int(msgs.get("Lap", [None] * len(times))[i]),
            }
            result.append(msg)
        return result
    except Exception:
        return []


def _team_radio(session, start):
    try:
        import fastf1._api as ff1_api

        entries = ff1_api.fetch_page(session.api_path, "team_radio")
        if not entries:
            return []

        t0 = getattr(session, "t0_date", None)
        if t0 is not None:
            t0 = pd.Timestamp(t0)
            if t0.tzinfo is not None:
                t0 = t0.tz_convert("UTC").tz_localize(None)

        base = ff1_api.base_url + session.api_path
        seen = set()
        result = []
        for _, content in entries:
            if not isinstance(content, dict):
                continue
            captures = content.get("Captures")
            if captures is None:
                continue
            if isinstance(captures, dict):
                captures = list(captures.values())
            if not isinstance(captures, list):
                continue
            for cap in captures:
                if not isinstance(cap, dict):
                    continue
                path = cap.get("Path")
                if not path or path in seen:
                    continue
                seen.add(path)

                clip_time = None
                utc = cap.get("Utc")
                if utc is not None and t0 is not None:
                    try:
                        ts = pd.Timestamp(utc)
                        if ts.tzinfo is not None:
                            ts = ts.tz_convert("UTC").tz_localize(None)
                        clip_time = round((ts - t0).total_seconds() - start, 1)
                    except Exception:
                        clip_time = None

                filename = path.rsplit("/", 1)[-1]
                code = filename.split("_", 1)[0] if "_" in filename else None
                code = code.upper() if code else None

                result.append({
                    "time": clip_time,
                    "driver_code": code,
                    "racing_number": _text(cap.get("RacingNumber")),
                    "url": base + path,
                })

        result.sort(key=lambda r: (r["time"] is None, r["time"] if r["time"] is not None else 0.0))
        return result
    except Exception:
        return []


def _session_bests(session, start):
    try:
        laps = session.laps
    except Exception:
        return []
    if laps is None or len(laps) == 0:
        return []

    sector_specs = [
        ("s1", "Sector1SessionTime", "Sector1Time"),
        ("s2", "Sector2SessionTime", "Sector2Time"),
        ("s3", "Sector3SessionTime", "Sector3Time"),
    ]

    events = []
    for _, lap in laps.iterrows():
        num = _text(lap.get("DriverNumber"))
        if num is None:
            continue
        for kind, tcol, vcol in sector_specs:
            st = lap.get(tcol)
            v = lap.get(vcol)
            if pd.notna(st) and pd.notna(v):
                events.append((
                    float(pd.Timedelta(st).total_seconds()),
                    num, kind,
                    round(float(pd.Timedelta(v).total_seconds()), 3),
                    "min", None,
                ))
        tt = lap.get("Time")
        sp = lap.get("SpeedST")
        if pd.notna(sp) and pd.notna(tt) and float(sp) > 0:
            events.append((
                float(pd.Timedelta(tt).total_seconds()),
                num, "st",
                round(float(sp), 1),
                "max", None,
            ))
        lt = lap.get("LapTime")
        if pd.notna(lt) and pd.notna(tt):
            sectors = [_seconds(lap.get("Sector1Time")), _seconds(lap.get("Sector2Time")), _seconds(lap.get("Sector3Time"))]
            events.append((
                float(pd.Timedelta(tt).total_seconds()),
                num, "lap",
                round(float(pd.Timedelta(lt).total_seconds()), 3),
                "min", {"sectors": sectors},
            ))

    events.sort(key=lambda e: e[0])
    best = {}
    records = []
    for t, num, kind, val, mode, extra in events:
        key = (num, kind)
        cur = best.get(key)
        improved = cur is None or (val < cur if mode == "min" else val > cur)
        if improved:
            best[key] = val
            record = {
                "time": round(t - start, 1),
                "driver": num,
                "kind": kind,
                "value": val,
            }
            if extra:
                record.update(extra)
            records.append(record)
    return records


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


def _session_window(session, start):
    try:
        status = session.session_status
        if status is None or len(status) == 0:
            return None
        started = None
        finished = None
        for _, row in status.iterrows():
            state = row.get("Status")
            if state == "Started" and started is None:
                started = row.get("Time")
            elif state == "Finished":
                finished = row.get("Time")
        if started is None:
            return None
        if finished is None:
            finished = status["Time"].iloc[-1]
        return {
            "start": round(float(pd.Timedelta(started).total_seconds()) - start, 2),
            "end": round(float(pd.Timedelta(finished).total_seconds()) - start, 2),
        }
    except Exception:
        return None


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


def _commentary(session, start):
    try:
        import fastf1._api as ff1_api
        import requests

        base = ff1_api.base_url + session.api_path
        resp = requests.get(
            base + "AudioStreams.json",
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        data = json.loads(resp.content.decode("utf-8-sig"))
        streams = data.get("Streams") if isinstance(data, dict) else None
        if not isinstance(streams, list) or not streams:
            return None

        stream = next(
            (s for s in streams if isinstance(s, dict) and str(s.get("Language", "")).lower() == "en"),
            None,
        ) or (streams[0] if isinstance(streams[0], dict) else None)
        path = stream.get("Path") if stream else None
        if not path:
            return None

        offset = None
        t0 = getattr(session, "t0_date", None)
        utc = stream.get("Utc")
        if utc is not None and t0 is not None:
            t0 = pd.Timestamp(t0)
            if t0.tzinfo is not None:
                t0 = t0.tz_convert("UTC").tz_localize(None)
            try:
                ts = pd.Timestamp(utc)
                if ts.tzinfo is not None:
                    ts = ts.tz_convert("UTC").tz_localize(None)
                offset = round((ts - t0).total_seconds() - start, 2)
            except Exception:
                offset = None

        return {
            "url": base + path,
            "start": offset,
            "language": stream.get("Language") or "en",
        }
    except Exception:
        return None


def _result_is_dns(row):
    if row is None:
        return False
    classified = _text(row.get("ClassifiedPosition"))
    if classified and classified.strip().upper() == "W":
        return True
    return (_text(row.get("Status")) or "").strip().lower() == "did not start"


def _result_is_dnf(row):
    if row is None or _result_is_dns(row):
        return False
    classified = _text(row.get("ClassifiedPosition"))
    if classified:
        c = classified.strip().upper()
        if c.isdigit():
            return False
        return c == "R"
    status = (_text(row.get("Status")) or "").strip().lower()
    if not status or status == "finished" or status.startswith("+") or "lap" in status:
        return False
    if status in ("did not qualify", "withdrew", "disqualified", "not classified"):
        return False
    return True


def _retired_time(session, number, start):
    try:
        laps = session.laps.pick_drivers(number)
    except Exception:
        return None
    if laps is None or len(laps) == 0:
        return None
    last = laps.iloc[-1]
    lap_start = last.get("LapStartTime")
    if lap_start is None or not pd.notna(lap_start):
        return None
    end = pd.Timedelta(lap_start).total_seconds()
    lap_time = last.get("LapTime")
    if lap_time is not None and pd.notna(lap_time):
        end += pd.Timedelta(lap_time).total_seconds()
    return round(end - start, 2)


def _empty_replay(step):
    return {
        "available": False,
        "has_position": False,
        "step": step,
        "duration": 0.0,
        "race_start": None,
        "track_status": [],
        "total_laps": None,
        "time": [],
        "track": {"x": [], "y": [], "sector_markers": []},
        "corners": [],
        "bounds": {"min_x": 0, "max_x": 0, "min_y": 0, "max_y": 0},
        "drivers": [],
        "positions": {},
        "laps": {},
        "race_control_messages": [],
        "team_radio": [],
        "session_bests": [],
        "weather": [],
        "qualifying_segments": [],
        "session_window": None,
        "commentary": None,
    }


def _replay_time_bounds(session):
    lo = None
    hi = None

    def consider(values):
        nonlocal lo, hi
        if values is None:
            return
        arr = np.asarray(values, dtype=float)
        arr = arr[~np.isnan(arr)]
        if arr.size == 0:
            return
        vlo = float(arr.min())
        vhi = float(arr.max())
        if lo is None or vlo < lo:
            lo = vlo
        if hi is None or vhi > hi:
            hi = vhi

    for number in session.drivers:
        car = session.car_data.get(number)
        if car is not None and len(car):
            consider(_seconds_axis(car))

    try:
        laps = session.laps
    except Exception:
        laps = None
    if laps is not None and len(laps):
        for col in ("LapStartTime", "Time", "Sector3SessionTime"):
            if col in laps:
                consider(laps[col].dt.total_seconds().to_numpy())

    weather = getattr(session, "weather_data", None)
    if weather is not None and len(weather) and "Time" in weather:
        consider(weather["Time"].dt.total_seconds().to_numpy())

    for attr in ("session_status", "track_status"):
        df = getattr(session, attr, None)
        if df is not None and len(df) and "Time" in df:
            consider(df["Time"].dt.total_seconds().to_numpy())

    if lo is None or hi is None or hi <= lo:
        return None
    return lo, hi


_TRACK_FALLBACK_SESSIONS = ("Q", "SQ", "FP3", "FP2", "FP1", "S")


def _fastest_lap_xy(session):
    # Returns (fastest_lap, lap_tel) with usable X/Y telemetry, or (None, None).
    try:
        fastest_lap = session.laps.pick_fastest()
    except Exception:
        return None, None
    if fastest_lap is None:
        return None, None
    try:
        lap_tel = fastest_lap.get_telemetry()
    except Exception:
        return None, None
    if "X" not in lap_tel or "Y" not in lap_tel or len(lap_tel) == 0:
        return None, None
    return fastest_lap, lap_tel


def _track_reference(session):
    # Returns (fastest_lap, lap_tel, info_session) describing a clean track
    # outline. Prefer the session itself; if its fastest-lap telemetry is
    # broken (incomplete sessions can drop the Date column the merge needs),
    # fall back to other sessions from the same event weekend (qualifying
    # first). The X/Y coordinate frame is shared across the weekend, so the
    # outline still lines up with this session's car positions.
    fastest_lap, lap_tel = _fastest_lap_xy(session)
    if lap_tel is not None:
        return fastest_lap, lap_tel, session

    year = getattr(session.event, "year", None)
    rnd = session.event.get("RoundNumber")
    if year is None or rnd is None:
        return None, None, None
    for name in _TRACK_FALLBACK_SESSIONS:
        if name == session.name:
            continue
        try:
            other = load_session(year, rnd, name)
        except Exception:
            continue
        fastest_lap, lap_tel = _fastest_lap_xy(other)
        if lap_tel is not None:
            return fastest_lap, lap_tel, other
    return None, None, None


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

    has_position = bool(samples)
    # Bound the replay by every data source, not just position. Position feeds
    # can stop early (incomplete sessions, retirements) while timing, laps,
    # weather and race control keep going; extend the grid so the rest of the
    # race still plays out even where there are no car positions.
    data_bounds = _replay_time_bounds(session)
    if has_position:
        start = float(min(starts))
        end = float(max(ends))
        if data_bounds is not None:
            end = max(end, data_bounds[1])
    else:
        if data_bounds is None:
            return _empty_replay(step)
        start, end = data_bounds
    grid = np.arange(start, end, step)
    if grid.size == 0:
        return _empty_replay(step)

    streams = _timing_streams(session)

    if has_position:
        driver_numbers = list(samples.keys())
    else:
        driver_numbers = list(
            dict.fromkeys(list(session.drivers) + list(results_by_number.keys()))
        )

    positions = {}
    drivers = []
    colour_map = None
    for number in driver_numbers:
        sample = samples.get(number)
        if sample is not None:
            times, pos = sample
            px, py = _grid_positions(grid, times, pos["X"].to_numpy(), pos["Y"].to_numpy())
            entry = {"x": px, "y": py}
        else:
            entry = {"x": [], "y": []}
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
        if colour_map is None and (row is None or not _text(row.get("TeamColor"))):
            colour_map = _event_colour_map(session)
        drivers.append({
            "number": number,
            "abbreviation": _text(row.get("Abbreviation")) if row is not None else None,
            "full_name": _text(row.get("FullName")) if row is not None else None,
            "team_name": _text(row.get("TeamName")) if row is not None else None,
            "team_colour": _driver_colour(row, colour_map),
            "headshot_url": _text(row.get("HeadshotUrl")) if row is not None else None,
            "retired_at": _retired_time(session, number, start) if _result_is_dnf(row) else None,
            "dns": _result_is_dns(row),
        })

    # Drivers who never started have no position data, so add them from the
    # results so they still appear (at the back) with a DNS badge.
    existing = {d["number"] for d in drivers}
    for number, row in results_by_number.items():
        if number in existing or not _result_is_dns(row):
            continue
        drivers.append({
            "number": number,
            "abbreviation": _text(row.get("Abbreviation")),
            "full_name": _text(row.get("FullName")),
            "team_name": _text(row.get("TeamName")),
            "team_colour": _driver_colour(row, colour_map),
            "headshot_url": _text(row.get("HeadshotUrl")),
            "retired_at": None,
            "dns": True,
        })
        positions[number] = {"x": [], "y": []}

    if has_position:
        fastest_lap, lap_tel, info_session = _track_reference(session)

        if lap_tel is None:
            # No session in the weekend has usable fastest-lap telemetry; fall
            # back to the raw position data we already collected so the track
            # outline still renders.
            longest = max(samples.values(), key=lambda s: len(s[1]))
            lap_tel = longest[1]

        tx = lap_tel["X"].to_numpy()
        ty = lap_tel["Y"].to_numpy()
        mask = ~(np.isnan(tx) | np.isnan(ty))
        # Raw position data marks off-track/garage samples with Status and
        # parks them at (0, 0); drop those so the outline doesn't draw a line
        # back to the origin.
        if "Status" in lap_tel:
            mask &= lap_tel["Status"].to_numpy() == "OnTrack"
        mask &= ~((tx == 0) & (ty == 0))
        track = {
            "x": [int(round(v)) for v in tx[mask]],
            "y": [int(round(v)) for v in ty[mask]],
        }

        sector_markers = []
        try:
            if fastest_lap is not None and "SessionTime" in lap_tel:
                sess_arr = lap_tel["SessionTime"].dt.total_seconds().to_numpy()
                for col in ("Sector1SessionTime", "Sector2SessionTime"):
                    st = fastest_lap.get(col)
                    if st is None or not pd.notna(st):
                        continue
                    target = pd.Timedelta(st).total_seconds()
                    j = int(np.nanargmin(np.abs(sess_arr - target)))
                    if not (np.isnan(tx[j]) or np.isnan(ty[j])):
                        sector_markers.append({"x": int(round(tx[j])), "y": int(round(ty[j]))})
        except Exception:
            sector_markers = []
        track["sector_markers"] = sector_markers

        corners = []
        info = None
        if info_session is not None:
            try:
                info = info_session.get_circuit_info()
            except Exception:
                info = None
        if info is not None:
            for _, corner in info.corners.iterrows():
                corners.append({
                    "number": _int(corner.get("Number")),
                    "letter": _text(corner.get("Letter")),
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
    else:
        track = {"x": [], "y": [], "sector_markers": []}
        corners = []
        bounds = {"min_x": 0, "max_x": 0, "min_y": 0, "max_y": 0}

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
    for number in (d["number"] for d in drivers):
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
                "s1": _seconds(lap.get("Sector1Time")),
                "s2": _seconds(lap.get("Sector2Time")),
                "s3": _seconds(lap.get("Sector3Time")),
                "s1_time": _seconds_rel(lap.get("Sector1SessionTime"), start),
                "s2_time": _seconds_rel(lap.get("Sector2SessionTime"), start),
                "s3_time": _seconds_rel(lap.get("Sector3SessionTime"), start),
            })
        laps_by_driver[number] = entries

    race_control = _race_control_messages(session, start)
    team_radio = _team_radio(session, start)
    session_bests = _session_bests(session, start)
    weather = _weather_series(session, start)
    qualifying_segments = _qualifying_segments(session, start)
    session_window = _session_window(session, start)
    commentary = _commentary(session, start)

    return {
        "available": True,
        "has_position": has_position,
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
        "team_radio": team_radio,
        "session_bests": session_bests,
        "weather": weather,
        "qualifying_segments": qualifying_segments,
        "session_window": session_window,
        "commentary": commentary,
    }
