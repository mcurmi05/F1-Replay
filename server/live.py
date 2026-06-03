import ast
import json
import logging
import os
import threading
from datetime import datetime, timedelta, timezone

import fastf1
import pandas as pd

import f1data

logger = logging.getLogger("f1live")

SKIP_TOPICS = set()

SESSION_TYPES = {
    "Practice 1": "FP1",
    "Practice 2": "FP2",
    "Practice 3": "FP3",
    "Qualifying": "Q",
    "Sprint Qualifying": "SQ",
    "Sprint Shootout": "SQ",
    "Sprint": "Sprint",
    "Race": "R",
}

WINDOW_MINUTES = {
    "FP1": 90,
    "FP2": 90,
    "FP3": 90,
    "Q": 120,
    "SQ": 90,
    "Sprint": 90,
    "R": 200,
}

TRACK_STATUS = {
    "1": "Track Clear",
    "2": "Yellow Flag",
    "3": "Yellow Flag",
    "4": "Safety Car",
    "5": "Red Flag",
    "6": "Virtual Safety Car",
    "7": "VSC Ending",
}

FINISHED_STATES = {"Finished", "Finalised", "Ends"}


def _merge(target, source):
    if not isinstance(source, dict):
        return source
    for key, value in source.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            target[key] = _merge(target[key], value)
        else:
            target[key] = value
    return target


def _parse_line(line):
    line = line.strip()
    if not line:
        return None
    try:
        record = ast.literal_eval(line)
    except (ValueError, SyntaxError):
        return None
    if not isinstance(record, list) or len(record) < 2:
        return None
    topic = record[0]
    payload = record[1]
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            return None
    return topic, payload


class LiveRecording:
    def __init__(self, path):
        self.path = path
        self._offset = 0
        self.topics = {}

    def poll(self):
        if not os.path.exists(self.path):
            return
        try:
            with open(self.path, "r") as handle:
                handle.seek(self._offset)
                lines = handle.readlines()
                self._offset = handle.tell()
        except OSError:
            return
        for line in lines:
            parsed = _parse_line(line)
            if parsed is None:
                continue
            topic, payload = parsed
            if topic in SKIP_TOPICS:
                continue
            current = self.topics.setdefault(topic, {})
            if isinstance(payload, dict):
                self.topics[topic] = _merge(current, payload)
            else:
                self.topics[topic] = payload

    def has_data(self):
        return bool(self.topics)


class LiveManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._session_key = None
        self._recording = None
        self._thread = None
        self._no_auth = os.environ.get("F1_LIVE_NO_AUTH", "").lower() in {"1", "true", "yes"}
        self._historical_key = None
        self._historical_cache = None

    def _live_dir(self):
        cache = f1data.get_cache()
        if cache is None:
            return None
        path = os.path.join(cache, "live")
        os.makedirs(path, exist_ok=True)
        return path

    def _start_recorder(self, session_key, filename):
        from fastf1.livetiming.client import SignalRClient

        def run():
            try:
                client = SignalRClient(
                    filename=filename,
                    filemode="a",
                    timeout=90,
                    logger=logger,
                    no_auth=self._no_auth,
                )
                client.start()
            except Exception:
                logger.exception("Live timing recorder stopped with an error")

        thread = threading.Thread(target=run, name=f"f1-live-{session_key}", daemon=True)
        thread.start()
        return thread

    def _ensure_recorder(self, session_key):
        live_dir = self._live_dir()
        if live_dir is None:
            return
        filename = os.path.join(live_dir, f"{session_key}.txt")
        if self._session_key != session_key:
            self._session_key = session_key
            self._recording = LiveRecording(filename)
            self._thread = None
        if self._thread is None or not self._thread.is_alive():
            self._thread = self._start_recorder(session_key, filename)

    def state(self):
        with self._lock:
            if not f1data.cache_valid():
                return _empty_snapshot(None)
            current = _current_session()
            if current is not None and current["live_window"]:
                key = current["key"]
                self._ensure_recorder(key)
                if self._recording is not None:
                    self._recording.poll()
                    if self._recording.has_data():
                        return _live_snapshot(current, self._recording.topics)
                return _connecting_snapshot(current)
            return self._historical_state(current)

    def _historical_state(self, current):
        if current is None or current.get("session") is None:
            return _empty_snapshot(current)
        if f1data.get_cache() is None:
            return _empty_snapshot(current, current["session"])
        if current["key"] != self._historical_key:
            self._historical_key = current["key"]
            self._historical_cache = _historical_snapshot(current)
        return self._historical_cache


def _session_rows(schedule):
    rows = []
    for _, row in schedule.iterrows():
        round_number = row.get("RoundNumber")
        if pd.isna(round_number):
            continue
        for index in range(1, 6):
            name = row.get(f"Session{index}")
            start = row.get(f"Session{index}DateUtc")
            if name is None or pd.isna(name) or pd.isna(start):
                continue
            session_type = SESSION_TYPES.get(str(name))
            if session_type is None:
                continue
            start_utc = pd.Timestamp(start)
            if start_utc.tzinfo is None:
                start_utc = start_utc.tz_localize("UTC")
            rows.append({
                "round": int(round_number),
                "year": int(pd.Timestamp(row.get("EventDate")).year),
                "event_name": f1data._text(row.get("EventName")),
                "location": f1data._text(row.get("Location")),
                "country": f1data._text(row.get("Country")),
                "session_name": str(name),
                "session_type": session_type,
                "start_utc": start_utc.to_pydatetime(),
            })
    return rows


def _all_sessions():
    now = datetime.now(timezone.utc)
    sessions = []
    for year in (now.year, now.year - 1):
        try:
            schedule = fastf1.get_event_schedule(year, include_testing=False)
        except Exception:
            continue
        sessions.extend(_session_rows(schedule))
    sessions.sort(key=lambda item: item["start_utc"])
    return sessions


def _current_session():
    now = datetime.now(timezone.utc)
    sessions = _all_sessions()
    if not sessions:
        return None

    past = [s for s in sessions if s["start_utc"] <= now]
    upcoming = [s for s in sessions if s["start_utc"] > now]
    next_session = upcoming[0] if upcoming else None

    if not past:
        return {
            "key": None,
            "live_window": False,
            "session": None,
            "next": next_session,
        }

    latest = past[-1]
    window = WINDOW_MINUTES.get(latest["session_type"], 120)
    end = latest["start_utc"] + timedelta(minutes=window)
    live_window = latest["start_utc"] - timedelta(minutes=5) <= now <= end
    key = f"{latest['year']}_{latest['round']}_{latest['session_type']}"
    return {
        "key": key,
        "live_window": live_window,
        "session": latest,
        "next": next_session,
    }


def _next_payload(current):
    if current is None or current.get("next") is None:
        return None
    nxt = current["next"]
    return {
        "event_name": nxt["event_name"],
        "session_name": nxt["session_name"],
        "start_utc": nxt["start_utc"].isoformat(),
    }


def _drivers_from_topics(topics):
    drivers = {}
    raw = topics.get("DriverList", {})
    for number, info in raw.items():
        if not isinstance(info, dict):
            continue
        drivers[str(number)] = {
            "abbreviation": info.get("Tla"),
            "full_name": info.get("FullName") or info.get("BroadcastName"),
            "team_name": info.get("TeamName"),
            "team_colour": info.get("TeamColour"),
        }
    return drivers


def _current_stint(app_line):
    stints = app_line.get("Stints")
    if not isinstance(stints, dict) or not stints:
        return None
    best_key = None
    for key in stints:
        try:
            value = int(key)
        except (TypeError, ValueError):
            continue
        if best_key is None or value > best_key:
            best_key = value
    if best_key is None:
        return None
    return stints.get(str(best_key))


def _stint_index(app_line):
    stints = app_line.get("Stints")
    if not isinstance(stints, dict) or not stints:
        return None, None
    best_key = None
    for key in stints:
        try:
            value = int(key)
        except (TypeError, ValueError):
            continue
        if best_key is None or value > best_key:
            best_key = value
    if best_key is None:
        return None, None
    return stints.get(str(best_key)), best_key


def _sectors(line):
    sectors = line.get("Sectors")
    if not isinstance(sectors, dict):
        return {"s1": None, "s2": None, "s3": None, "s1_pb": False, "s2_pb": False, "s3_pb": False}
    result = {}
    for i, key in enumerate(["0", "1", "2"], 1):
        sector = sectors.get(key, {})
        if isinstance(sector, dict):
            value = _clean(sector.get("Value"))
            result[f"s{i}"] = value
            result[f"s{i}_pb"] = bool(sector.get("PersonalFastest", False))
        else:
            result[f"s{i}"] = None
            result[f"s{i}_pb"] = False
    return result


def _speeds(line):
    speeds = line.get("Speeds")
    if not isinstance(speeds, dict):
        return {"i1": None, "i2": None, "fl": None, "st": None}
    result = {}
    for key, short in [("I1", "i1"), ("I2", "i2"), ("FL", "fl"), ("ST", "st")]:
        speed = speeds.get(key, {})
        if isinstance(speed, dict):
            result[short] = _clean(speed.get("Value"))
        else:
            result[short] = None
    return result


def _race_control_live(topics):
    rcm = topics.get("RaceControlMessages", {})
    if not isinstance(rcm, dict):
        return []
    messages = rcm.get("Messages", {})
    if not isinstance(messages, dict):
        return []
    result = []
    for key, msg in messages.items():
        if not isinstance(msg, dict):
            continue
        result.append({
            "time": _clean(msg.get("Utc")),
            "category": _clean(msg.get("Category")),
            "message": _clean(msg.get("Message")),
            "status": _clean(msg.get("Status")),
            "flag": _clean(msg.get("Flag")),
            "scope": _clean(msg.get("Scope")),
            "sector": msg.get("Sector"),
            "racing_number": _clean(msg.get("RacingNumber")),
            "lap": msg.get("Lap"),
        })
    result.sort(key=lambda m: m["time"] or "")
    return result


def _team_radio_live(topics):
    tr = topics.get("TeamRadio", {})
    if not isinstance(tr, dict):
        return []
    captures = tr.get("Captures", {})
    if not isinstance(captures, dict):
        return []
    result = []
    for key, capture in captures.items():
        if not isinstance(capture, dict):
            continue
        path = capture.get("Path")
        if path:
            result.append({
                "utc": _clean(capture.get("Utc")),
                "driver_number": _clean(str(capture.get("RacingNumber"))),
                "url": f"https://livetiming.formula1.com/static/{path}",
            })
    result.sort(key=lambda c: c["utc"] or "")
    return result


def _position_data_live(topics):
    pos = topics.get("Position.z", {})
    if not isinstance(pos, dict):
        return {}

    drivers = pos.get("Entries", {})
    if not isinstance(drivers, dict):
        return {}

    result = {}
    for number_str, entry in drivers.items():
        if not isinstance(entry, dict):
            continue
        x = entry.get("X")
        y = entry.get("Y")
        z = entry.get("Z")
        if x is not None and y is not None:
            try:
                result[str(number_str)] = {
                    "x": float(x),
                    "y": float(y),
                    "z": float(z) if z is not None else None,
                }
            except (TypeError, ValueError):
                pass
    return result


def _car_data_live(topics):
    car = topics.get("CarData.z", {})
    if not isinstance(car, dict):
        return {}

    drivers = car.get("Entries", {})
    if not isinstance(drivers, dict):
        return {}

    result = {}
    for number_str, entry in drivers.items():
        if not isinstance(entry, dict):
            continue
        try:
            result[str(number_str)] = {
                "speed": _to_float(entry.get("Speed")),
                "throttle": _to_float(entry.get("Throttle")),
                "brake": _to_float(entry.get("Brake")),
                "gear": _to_int(entry.get("Gear")),
                "rpm": _to_int(entry.get("RPM")),
                "drs": _to_int(entry.get("DRS")),
            }
        except (TypeError, ValueError):
            pass
    return result


def _live_snapshot(current, topics):
    session = current["session"]
    drivers = _drivers_from_topics(topics)
    timing = topics.get("TimingData", {}).get("Lines", {})
    app_data = topics.get("TimingAppData", {}).get("Lines", {})

    position_data = _position_data_live(topics)
    car_data = _car_data_live(topics)
    track = _get_track_geometry(session.get("year"), session.get("round"), session.get("session_type"))

    rows = []
    for number, line in timing.items():
        if not isinstance(line, dict):
            continue
        info = drivers.get(str(number), {})
        app_line = app_data.get(number, {}) if isinstance(app_data.get(number), dict) else {}
        stint, stint_number = _stint_index(app_line)
        stint = stint or {}
        pos = position_data.get(str(number), {})
        car = car_data.get(str(number), {})

        position = line.get("Position")
        try:
            position = int(position) if position not in (None, "") else None
        except (TypeError, ValueError):
            position = None

        in_pit = bool(line.get("InPit"))
        retired = bool(line.get("Retired")) or bool(line.get("Stopped"))
        if retired:
            status = "OUT"
        elif in_pit:
            status = "PIT"
        else:
            status = None

        tyre_age = stint.get("TotalLaps")
        try:
            tyre_age = int(tyre_age) if tyre_age is not None else None
        except (TypeError, ValueError):
            tyre_age = None

        sectors = _sectors(line)
        speeds = _speeds(line)

        rows.append({
            "position": position,
            "driver_number": str(number),
            "abbreviation": info.get("abbreviation"),
            "full_name": info.get("full_name"),
            "team_name": info.get("team_name"),
            "team_colour": info.get("team_colour"),
            "gap": _clean(line.get("GapToLeader")),
            "interval": _clean(_nested(line, "IntervalToPositionAhead", "Value")),
            "last_lap": _clean(_nested(line, "LastLapTime", "Value")),
            "best_lap": _clean(_nested(line, "BestLapTime", "Value")),
            "compound": _compound(stint.get("Compound")),
            "tyre_age": tyre_age,
            "stint": stint_number,
            "sector_1": sectors["s1"],
            "sector_2": sectors["s2"],
            "sector_3": sectors["s3"],
            "sector_1_pb": sectors["s1_pb"],
            "sector_2_pb": sectors["s2_pb"],
            "sector_3_pb": sectors["s3_pb"],
            "speed_i1": speeds["i1"],
            "speed_i2": speeds["i2"],
            "speed_fl": speeds["fl"],
            "speed_st": speeds["st"],
            "pit_stops": _to_int(line.get("NumberOfPitStops")),
            "tyre_fresh": bool(stint.get("New")) if stint.get("New") is not None else None,
            "x": pos.get("x"),
            "y": pos.get("y"),
            "z": pos.get("z"),
            "speed": car.get("speed"),
            "throttle": car.get("throttle"),
            "brake": car.get("brake"),
            "gear": car.get("gear"),
            "rpm": car.get("rpm"),
            "drs": car.get("drs"),
            "in_pit": in_pit,
            "retired": retired,
            "status": status,
        })

    rows.sort(key=lambda item: item["position"] if item["position"] is not None else 999)

    session_status = _nested(topics, "SessionStatus", "Status")
    track_status_code = _clean(_nested(topics, "TrackStatus", "Status"))
    lap_count = topics.get("LapCount", {})
    clock = topics.get("ExtrapolatedClock", {})
    weather = topics.get("WeatherData", {})

    live = bool(session_status) and session_status not in FINISHED_STATES

    return {
        "available": True,
        "live": live,
        "source": "live",
        "session": {
            "event_name": session["event_name"],
            "location": session["location"],
            "country": session["country"],
            "session_name": session["session_name"],
            "session_type": session["session_type"],
            "status": session_status or "Live",
            "track_status": {
                "code": track_status_code,
                "message": TRACK_STATUS.get(track_status_code or "", "") if track_status_code else "",
            },
            "current_lap": _to_int(lap_count.get("CurrentLap")),
            "total_laps": _to_int(lap_count.get("TotalLaps")),
            "time_remaining": _clean(clock.get("Remaining")),
            "started_at": session["start_utc"].isoformat(),
        },
        "weather": _weather(weather),
        "rows": rows,
        "race_control_messages": _race_control_live(topics),
        "team_radio": _team_radio_live(topics),
        "track": track,
        "next_session": _next_payload(current),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _empty_snapshot(current, session_meta=None):
    return {
        "available": False,
        "live": False,
        "source": "none",
        "session": _session_meta_payload(session_meta, "Finished") if session_meta else None,
        "weather": None,
        "rows": [],
        "race_control_messages": [],
        "team_radio": [],
        "track": {"x": [], "y": []},
        "next_session": _next_payload(current),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _connecting_snapshot(current):
    session = current["session"]
    track = _get_track_geometry(session.get("year"), session.get("round"), session.get("session_type"))
    return {
        "available": False,
        "live": True,
        "source": "live",
        "session": _session_meta_payload(session, "Connecting"),
        "weather": None,
        "rows": [],
        "race_control_messages": [],
        "team_radio": [],
        "track": track,
        "next_session": _next_payload(current),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _load_results_only(year, event, session_type):
    import threading as _threading

    with _threading.Lock():
        session = fastf1.get_session(year, event, session_type)
        session.load(laps=True, telemetry=False, weather=False, messages=False)
    return session


def _get_track_geometry(year, round_num, session_type):
    """Load track geometry from a session's fastest lap telemetry."""
    if not year or not round_num:
        return {"x": [], "y": []}

    try:
        import threading as _threading
        import numpy as np

        with _threading.Lock():
            session = fastf1.get_session(year, round_num, session_type)
            session.load(laps=True, telemetry=True, weather=False, messages=False)

        fastest_lap = session.laps.pick_fastest()
        if fastest_lap.empty or len(fastest_lap) == 0:
            return {"x": [], "y": []}

        lap_tel = fastest_lap.get_telemetry()
        if lap_tel is None or len(lap_tel) == 0:
            return {"x": [], "y": []}

        tx = lap_tel["X"].to_numpy()
        ty = lap_tel["Y"].to_numpy()
        mask = ~(np.isnan(tx) | np.isnan(ty))

        if not np.any(mask):
            return {"x": [], "y": []}

        return {
            "x": [int(round(float(v))) for v in tx[mask]],
            "y": [int(round(float(v))) for v in ty[mask]],
        }
    except Exception as e:
        logger.warning(f"Could not load track geometry for {year}/{round_num}/{session_type}: {e}")
        return {"x": [], "y": []}


def _historical_snapshot(current):
    session_meta = current["session"]
    try:
        loaded = _load_results_only(
            session_meta["year"], session_meta["round"], session_meta["session_type"]
        )
    except Exception:
        logger.exception("Failed to load historical session for live fallback")
        return _empty_snapshot(current, session_meta)

    rows = _historical_rows(loaded)
    rows = _historical_rows_with_new_fields(rows)
    track = _get_track_geometry(session_meta.get("year"), session_meta.get("round"), session_meta.get("session_type"))
    return {
        "available": bool(rows),
        "live": False,
        "source": "historical",
        "session": _session_meta_payload(session_meta, "Finished", loaded),
        "weather": None,
        "rows": rows,
        "race_control_messages": [],
        "team_radio": [],
        "track": track,
        "next_session": _next_payload(current),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _historical_rows(session):
    fastest = {}
    try:
        for number in session.drivers:
            laps = session.laps.pick_drivers(number)
            if len(laps) == 0:
                continue
            best = laps.pick_fastest()
            if best is not None:
                fastest[str(number)] = best
    except Exception:
        fastest = {}

    rows = []
    for _, row in session.results.iterrows():
        number = f1data._text(row.get("DriverNumber"))
        best = fastest.get(number)
        compound = None
        tyre_age = None
        if best is not None:
            compound = _compound(f1data._text(best.get("Compound")))
            tyre = best.get("TyreLife")
            tyre_age = int(tyre) if tyre is not None and not pd.isna(tyre) else None

        time_value = f1data._seconds(row.get("Time"))
        position = f1data._int(row.get("Position"))
        status = f1data._text(row.get("Status")) or "Finished"
        gap = _result_gap(position, time_value, status)

        rows.append({
            "position": position,
            "driver_number": number,
            "abbreviation": f1data._text(row.get("Abbreviation")),
            "full_name": f1data._text(row.get("FullName")),
            "team_name": f1data._text(row.get("TeamName")),
            "team_colour": f1data._text(row.get("TeamColor")),
            "gap": gap,
            "interval": None,
            "last_lap": None,
            "best_lap": _lap_time(best) if best is not None else None,
            "compound": compound,
            "tyre_age": tyre_age,
            "stint": None,
            "in_pit": False,
            "retired": bool(status and status not in ("Finished",) and not status.startswith("+")),
            "status": None if (status == "Finished" or (status or "").startswith("+")) else status,
        })

    rows.sort(key=lambda item: item["position"] if item["position"] is not None else 999)
    return rows


def _historical_rows_with_new_fields(rows):
    for row in rows:
        row["sector_1"] = None
        row["sector_2"] = None
        row["sector_3"] = None
        row["sector_1_pb"] = False
        row["sector_2_pb"] = False
        row["sector_3_pb"] = False
        row["speed_i1"] = None
        row["speed_i2"] = None
        row["speed_fl"] = None
        row["speed_st"] = None
        row["pit_stops"] = None
        row["tyre_fresh"] = None
        row["x"] = None
        row["y"] = None
        row["z"] = None
        row["speed"] = None
        row["throttle"] = None
        row["brake"] = None
        row["gear"] = None
        row["rpm"] = None
        row["drs"] = None
    return rows


def _result_gap(position, time_value, status):
    if status and status != "Finished" and not status.startswith("+"):
        return status
    if position == 1:
        return "Leader"
    if time_value is None:
        return None
    return f"+{time_value:.3f}"


def _lap_time(lap):
    value = lap.get("LapTime")
    if value is None or pd.isna(value):
        return None
    total = pd.Timedelta(value).total_seconds()
    minutes = int(total // 60)
    seconds = total - minutes * 60
    return f"{minutes}:{seconds:06.3f}"


def _session_meta_payload(session_meta, status, loaded=None):
    total_laps = None
    if loaded is not None:
        total_laps = _to_int(getattr(loaded, "total_laps", None))
    return {
        "event_name": session_meta["event_name"],
        "location": session_meta["location"],
        "country": session_meta["country"],
        "session_name": session_meta["session_name"],
        "session_type": session_meta["session_type"],
        "status": status,
        "track_status": {"code": None, "message": ""},
        "current_lap": total_laps,
        "total_laps": total_laps,
        "time_remaining": None,
        "started_at": session_meta["start_utc"].isoformat(),
    }


def _weather(weather):
    if not isinstance(weather, dict) or not weather:
        return None
    return {
        "air_temp": _to_float(weather.get("AirTemp")),
        "track_temp": _to_float(weather.get("TrackTemp")),
        "humidity": _to_float(weather.get("Humidity")),
        "rainfall": str(weather.get("Rainfall")) in ("1", "True", "true"),
        "wind_speed": _to_float(weather.get("WindSpeed")),
        "wind_direction": _to_float(weather.get("WindDirection")),
        "pressure": _to_float(weather.get("Pressure")),
    }


def _compound(value):
    if value is None:
        return None
    text = str(value).upper()
    return text if text else None


def _nested(data, *keys):
    current = data
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _clean(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


_manager = LiveManager()
_test_mode = os.environ.get("F1_LIVE_TEST_DATA", "").lower() in {"1", "true", "yes"}


def live_state():
    if _test_mode:
        return _live_state_test()
    return _manager.state()


def _live_state_test():
    import ast

    test_file = os.environ.get("F1_LIVE_TEST_FILE", "/tmp/test_live_data.txt")
    if not os.path.exists(test_file):
        return _empty_snapshot(None)

    topics = {}
    try:
        with open(test_file, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = ast.literal_eval(line)
                    if isinstance(record, list) and len(record) >= 2:
                        topic, payload = record[0], record[1]
                        if isinstance(payload, str):
                            try:
                                payload = json.loads(payload)
                            except json.JSONDecodeError:
                                pass
                        topics[topic] = payload
                except (ValueError, SyntaxError):
                    pass
    except Exception:
        return _empty_snapshot(None)

    current = _current_session()
    if current is None:
        return _empty_snapshot(None)

    return _live_snapshot(current, topics)
