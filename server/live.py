import ast
import base64
import copy
import json
import logging
import os
import threading
import time
import zlib
from datetime import datetime, timedelta, timezone

import fastf1
import pandas as pd

import f1data
import liveauth

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
        existing = target.get(key)
        if isinstance(value, dict):
            if isinstance(existing, list):
                existing = {str(i): item for i, item in enumerate(existing)}
            if isinstance(existing, dict):
                target[key] = _merge(existing, value)
            else:
                target[key] = value
        else:
            target[key] = value
    return target


def _inflate(data):
    if not isinstance(data, str):
        return data if isinstance(data, dict) else None
    s = data.strip()
    if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
        s = s[1:-1]
    if s[:1] in ("{", "["):
        try:
            return json.loads(s)
        except json.JSONDecodeError:
            return None
    try:
        raw = zlib.decompress(base64.b64decode(s), -zlib.MAX_WBITS)
        return json.loads(raw.decode("utf-8-sig"))
    except Exception:
        return None


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
        if isinstance(topic, str) and topic.endswith(".z"):
            payload = _inflate(payload)
        else:
            try:
                payload = json.loads(payload)
            except json.JSONDecodeError:
                return None
    if payload is None:
        return None
    return topic, payload


class LiveFeed:
    """Holds the live SignalR topic state directly in memory, updated straight
    from the client callback. No files are written or read: readers always see
    exactly what the SignalR stream currently holds."""

    def __init__(self):
        self._lock = threading.Lock()
        self.topics = {}
        self.retired = set()
        self._session_key = None

    @staticmethod
    def _decode(topic, payload):
        if isinstance(payload, str):
            if topic.endswith(".z"):
                return _inflate(payload)
            try:
                return json.loads(payload)
            except (json.JSONDecodeError, TypeError):
                return None
        return payload

    @staticmethod
    def _key_of(info):
        if isinstance(info, dict):
            return info.get("Key") or info.get("Name")
        return None

    def _track_retired(self, payload):
        lines = payload.get("Lines") if isinstance(payload, dict) else None
        if not isinstance(lines, dict):
            return
        for number, line in lines.items():
            if not isinstance(line, dict):
                continue
            if line.get("Retired") or line.get("Stopped"):
                self.retired.add(str(number))
            if line.get("PitOut"):
                self.retired.discard(str(number))

    def reset(self, raw_topics):
        """Apply a full Subscribe snapshot, replacing our state so we mirror the
        feed's authoritative current view (this is also how reconnects and
        session changes come through)."""
        decoded = {}
        for topic, value in raw_topics.items():
            if topic in SKIP_TOPICS:
                continue
            value = self._decode(topic, value)
            if value is not None:
                decoded[topic] = value
        with self._lock:
            key = self._key_of(decoded.get("SessionInfo"))
            if key != self._session_key:
                self.retired = set()
                self._session_key = key
            timing = decoded.get("TimingData")
            if timing is not None:
                self._track_retired(timing)
            self.topics = decoded

    def update(self, topic, payload):
        """Apply a streaming delta, merging it into the current state."""
        if topic in SKIP_TOPICS:
            return
        payload = self._decode(topic, payload)
        if payload is None:
            return
        with self._lock:
            if topic == "TimingData":
                self._track_retired(payload)
            if topic == "SessionInfo":
                key = self._key_of(payload)
                if key is not None and key != self._session_key:
                    self._session_key = key
            current = self.topics.get(topic)
            if isinstance(payload, dict):
                base = current if isinstance(current, dict) else {}
                self.topics[topic] = _merge(base, payload)
            else:
                self.topics[topic] = payload

    def snapshot(self):
        with self._lock:
            return copy.deepcopy(self.topics), set(self.retired)


class LiveManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._feed = LiveFeed()
        self._thread = None
        self._no_auth = os.environ.get("F1_LIVE_NO_AUTH", "").lower() in {"1", "true", "yes"}

    def _start_client(self):
        from fastf1.livetiming.client import SignalRClient
        from signalrcore.messages.completion_message import CompletionMessage

        feed = self._feed
        no_auth = self._no_auth

        class _InMemoryClient(SignalRClient):
            def __init__(self):
                # filename is required by the base client but we never write to
                # it; route it to the null device so no stream file is created.
                super().__init__(
                    filename=os.devnull,
                    filemode="a",
                    timeout=90,
                    logger=logger,
                    no_auth=no_auth,
                )
                for extra in ("PitLaneTimeCollection", "ChampionshipPrediction"):
                    if extra not in self.topics:
                        self.topics = list(self.topics) + [extra]

            def _on_message(self, msg):
                self._t_last_message = time.time()
                try:
                    if isinstance(msg, CompletionMessage):
                        if isinstance(msg.result, dict):
                            feed.reset(msg.result)
                    elif isinstance(msg, list) and len(msg) >= 2:
                        feed.update(msg[0], msg[1])
                except Exception:
                    self.logger.exception("Error handling live message")

        def run():
            try:
                _InMemoryClient().start()
            except Exception:
                logger.exception("Live timing client stopped with an error")

        thread = threading.Thread(target=run, name="f1-live", daemon=True)
        thread.start()
        return thread

    def _ensure_client(self):
        if self._thread is None or not self._thread.is_alive():
            self._thread = self._start_client()

    def state(self):
        with self._lock:
            if not f1data.cache_valid():
                return _no_session_snapshot()
            if not self._no_auth and not liveauth.is_authenticated():
                return _auth_required_snapshot()
            self._ensure_client()
            topics, retired = self._feed.snapshot()
        info = topics.get("SessionInfo")
        timing = topics.get("TimingData")
        has_session = (isinstance(info, dict) and info.get("Name")) or (
            isinstance(timing, dict) and bool(timing.get("Lines"))
        )
        if has_session:
            return _live_snapshot(topics, retired)
        return _no_session_snapshot()

    def raw_topics(self):
        with self._lock:
            if not f1data.cache_valid():
                return {"available": False, "source": "none", "topics": {}}
            if not self._no_auth and not liveauth.is_authenticated():
                return {"available": False, "source": "none", "topics": {}}
            self._ensure_client()
            topics, _ = self._feed.snapshot()
        info = topics.get("SessionInfo")
        key = (info.get("Key") or info.get("Name")) if isinstance(info, dict) else None
        return {
            "available": bool(topics),
            "source": "live",
            "session_key": key,
            "topics": topics,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }


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


def _next_upcoming():
    now = datetime.now(timezone.utc)
    for session in _all_sessions():
        if session["start_utc"] > now:
            return {
                "event_name": session["event_name"],
                "session_name": session["session_name"],
                "start_utc": session["start_utc"].isoformat(),
            }
    return None


def _parse_gmt_offset(offset):
    if not isinstance(offset, str) or not offset.strip():
        return timedelta()
    sign = -1 if offset.strip().startswith("-") else 1
    parts = offset.strip().lstrip("+-").split(":")
    values = [int(p) for p in parts[:3]] + [0, 0, 0]
    return sign * timedelta(hours=values[0], minutes=values[1], seconds=values[2])


def _info_start_utc(start_raw, offset):
    if not isinstance(start_raw, str) or not start_raw:
        return None
    try:
        local = pd.Timestamp(start_raw)
    except (ValueError, TypeError):
        return None
    if local.tzinfo is not None:
        return local.tz_convert("UTC").to_pydatetime()
    utc = local - _parse_gmt_offset(offset)
    return utc.tz_localize("UTC").to_pydatetime()


def _session_info_meta(topics):
    info = topics.get("SessionInfo")
    if not isinstance(info, dict):
        return None
    name = info.get("Name")
    meeting = info.get("Meeting") if isinstance(info.get("Meeting"), dict) else {}
    country = meeting.get("Country") if isinstance(meeting.get("Country"), dict) else {}
    start_utc = _info_start_utc(info.get("StartDate"), info.get("GmtOffset"))
    return {
        "event_name": meeting.get("Name"),
        "location": meeting.get("Location"),
        "country": country.get("Name"),
        "session_name": name,
        "session_type": SESSION_TYPES.get(str(name)) if name else None,
        "start_utc": start_utc,
        "year": start_utc.year if start_utc else None,
        "round": _to_int(meeting.get("Number")),
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
            "headshot_url": _clean(info.get("HeadshotUrl")),
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
    if isinstance(stints, list):
        stints = {str(i): item for i, item in enumerate(stints)}
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


def _values(coll):
    """SignalR sends collections as arrays in the initial snapshot and as
    index-keyed dicts in deltas. Yield the values for either shape."""
    if isinstance(coll, dict):
        return list(coll.values())
    if isinstance(coll, list):
        return coll
    return []


def _race_control_live(topics):
    rcm = topics.get("RaceControlMessages", {})
    if not isinstance(rcm, dict):
        return []
    result = []
    for msg in _values(rcm.get("Messages")):
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
    # Capture Path is relative to the session directory (SessionInfo.Path), e.g.
    # "TeamRadio/MAXVER01_1_....mp3"; the playable URL is static/<session>/<path>.
    session_path = _clean(_nested(topics, "SessionInfo", "Path")) or ""
    base = f"https://livetiming.formula1.com/static/{session_path}"
    result = []
    for capture in _values(tr.get("Captures")):
        if not isinstance(capture, dict):
            continue
        path = capture.get("Path")
        if path:
            result.append({
                "utc": _clean(capture.get("Utc")),
                "driver_number": _clean(str(capture.get("RacingNumber"))),
                "url": f"{base}{path}",
            })
    result.sort(key=lambda c: c["utc"] or "")
    return result


def _commentary_live(topics):
    audio = topics.get("AudioStreams", {})
    if not isinstance(audio, dict):
        return None
    streams = _values(audio.get("Streams"))
    if not streams:
        return None
    stream = next(
        (s for s in streams if isinstance(s, dict) and str(s.get("Language", "")).lower() == "en"),
        None,
    ) or (streams[0] if isinstance(streams[0], dict) else None)
    if not isinstance(stream, dict):
        return None
    # The live stream is the Uri straight from the feed (rdio.formula1.com); the
    # relative Path is only the post-session archive that replay uses.
    url = _clean(stream.get("Uri"))
    if not url:
        return None
    return {"url": url, "start": None, "language": stream.get("Language") or "en"}


def _pit_times_live(topics):
    coll = topics.get("PitLaneTimeCollection", {})
    if not isinstance(coll, dict):
        return []
    result = []
    for info in _values(coll.get("PitTimes")):
        if not isinstance(info, dict):
            continue
        number = info.get("RacingNumber")
        if number is None:
            continue
        duration = _clean(info.get("Duration"))
        if not duration:
            continue
        result.append({
            "driver_number": str(number),
            "duration": duration,
            "lap": _to_int(info.get("Lap")),
        })
    return result


def _timing_stats_live(topics):
    stats = topics.get("TimingStats", {})
    if not isinstance(stats, dict):
        return {}
    lines = stats.get("Lines", {})
    if not isinstance(lines, dict):
        return {}
    result = {}
    for number, line in lines.items():
        if not isinstance(line, dict):
            continue
        pb = line.get("PersonalBestLapTime")
        pb = pb if isinstance(pb, dict) else {}

        best_sectors = [None, None, None]
        sectors = line.get("BestSectors")
        if isinstance(sectors, list):
            for i, sec in enumerate(sectors[:3]):
                if isinstance(sec, dict):
                    best_sectors[i] = _clean(sec.get("Value"))
        elif isinstance(sectors, dict):
            for i, key in enumerate(["0", "1", "2"]):
                sec = sectors.get(key)
                if isinstance(sec, dict):
                    best_sectors[i] = _clean(sec.get("Value"))

        best_speeds = {}
        speeds = line.get("BestSpeeds")
        if isinstance(speeds, dict):
            for key, short in [("I1", "i1"), ("I2", "i2"), ("FL", "fl"), ("ST", "st")]:
                sp = speeds.get(key)
                best_speeds[short] = _clean(sp.get("Value")) if isinstance(sp, dict) else None

        result[str(number)] = {
            "best_lap": _clean(pb.get("Value")),
            "best_lap_position": _to_int(pb.get("Position")),
            "best_sectors": best_sectors,
            "best_speeds": best_speeds,
        }
    return result


def _championship_live(topics):
    champ = topics.get("ChampionshipPrediction")
    if not isinstance(champ, dict):
        return None
    drivers_info = _drivers_from_topics(topics)
    drivers = []
    raw_drivers = champ.get("Drivers")
    if isinstance(raw_drivers, dict):
        for number, entry in raw_drivers.items():
            if not isinstance(entry, dict):
                continue
            info = drivers_info.get(str(number), {})
            drivers.append({
                "driver_number": str(number),
                "abbreviation": info.get("abbreviation"),
                "team_colour": info.get("team_colour"),
                "current_position": _to_int(entry.get("CurrentPosition")),
                "predicted_position": _to_int(entry.get("PredictedPosition")),
                "current_points": _to_float(entry.get("CurrentPoints")),
                "predicted_points": _to_float(entry.get("PredictedPoints")),
            })
    teams = []
    raw_teams = champ.get("Teams")
    if isinstance(raw_teams, dict):
        for key, entry in raw_teams.items():
            if not isinstance(entry, dict):
                continue
            teams.append({
                "team_name": entry.get("TeamName") or str(key),
                "current_position": _to_int(entry.get("CurrentPosition")),
                "predicted_position": _to_int(entry.get("PredictedPosition")),
                "current_points": _to_float(entry.get("CurrentPoints")),
                "predicted_points": _to_float(entry.get("PredictedPoints")),
            })
    if not drivers and not teams:
        return None
    drivers.sort(key=lambda d: d["predicted_position"] if d["predicted_position"] is not None else 999)
    teams.sort(key=lambda t: t["predicted_position"] if t["predicted_position"] is not None else 999)
    return {"drivers": drivers, "teams": teams}


def _position_data_live(topics):
    pos = topics.get("Position.z")
    if not isinstance(pos, dict):
        return {}
    series = pos.get("Position")
    if not isinstance(series, list) or not series:
        return {}
    latest = series[-1]
    drivers = latest.get("Entries") if isinstance(latest, dict) else None
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
                fx = float(x)
                fy = float(y)
                fz = float(z) if z is not None else None
            except (TypeError, ValueError):
                continue
            # 0,0,0 is the feed's initialisation value, not a real location.
            if fx == 0 and fy == 0 and (fz == 0 or fz is None):
                continue
            result[str(number_str)] = {"x": fx, "y": fy, "z": fz}
    return result


_CAR_CHANNELS = {"rpm": "0", "speed": "2", "gear": "3", "throttle": "4", "brake": "5", "drs": "45"}


def _car_data_live(topics):
    car = topics.get("CarData.z")
    if not isinstance(car, dict):
        return {}
    entries = car.get("Entries")
    if not isinstance(entries, list) or not entries:
        return {}
    latest = entries[-1]
    cars = latest.get("Cars") if isinstance(latest, dict) else None
    if not isinstance(cars, dict):
        return {}

    result = {}
    for number_str, entry in cars.items():
        channels = entry.get("Channels") if isinstance(entry, dict) else None
        if not isinstance(channels, dict):
            continue
        result[str(number_str)] = {
            "speed": _to_float(channels.get(_CAR_CHANNELS["speed"])),
            "throttle": _to_float(channels.get(_CAR_CHANNELS["throttle"])),
            "brake": _to_float(channels.get(_CAR_CHANNELS["brake"])),
            "gear": _to_int(channels.get(_CAR_CHANNELS["gear"])),
            "rpm": _to_int(channels.get(_CAR_CHANNELS["rpm"])),
            "drs": _to_int(channels.get(_CAR_CHANNELS["drs"])),
        }
    return result


def _live_snapshot(topics, retired_set=None):
    retired_set = retired_set or set()
    session = _session_info_meta(topics) or {
        "event_name": None, "location": None, "country": None,
        "session_name": None, "session_type": None,
        "start_utc": None, "year": None, "round": None,
    }
    drivers = _drivers_from_topics(topics)
    timing = topics.get("TimingData", {}).get("Lines", {})
    app_data = topics.get("TimingAppData", {}).get("Lines", {})

    position_data = _position_data_live(topics)
    car_data = _car_data_live(topics)
    track = _get_track_geometry(session.get("year"), session.get("round"), session.get("session_type"), session.get("event_name"))

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
        retired = bool(line.get("Retired")) or bool(line.get("Stopped")) or str(number) in retired_set
        laps_done = _to_int(line.get("NumberOfLaps"))
        if retired and (laps_done is None or laps_done == 0):
            status = "DNS"
        elif retired:
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
            "headshot_url": info.get("headshot_url"),
            "gap": _clean(line.get("GapToLeader")) or _clean(line.get("TimeDiffToFastest")),
            "interval": _clean(_nested(line, "IntervalToPositionAhead", "Value")) or _clean(line.get("TimeDiffToPositionAhead")),
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
            "time_remaining": _extrapolated_remaining(clock),
            "started_at": session["start_utc"].isoformat() if session["start_utc"] else None,
        },
        "weather": _weather(weather),
        "rows": rows,
        "race_control_messages": _race_control_live(topics),
        "team_radio": _team_radio_live(topics),
        "pit_times": _pit_times_live(topics),
        "timing_stats": _timing_stats_live(topics),
        "commentary": _commentary_live(topics),
        "championship": _championship_live(topics),
        "track": track,
        "next_session": _next_upcoming(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _auth_required_snapshot():
    return {
        "available": False,
        "live": False,
        "auth_required": True,
        "source": "live",
        "session": None,
        "weather": None,
        "rows": [],
        "race_control_messages": [],
        "team_radio": [],
        "pit_times": [],
        "timing_stats": {},
        "commentary": None,
        "championship": None,
        "track": {"x": [], "y": []},
        "next_session": _next_upcoming(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _no_session_snapshot():
    return {
        "available": False,
        "live": False,
        "source": "none",
        "session": None,
        "weather": None,
        "rows": [],
        "race_control_messages": [],
        "team_radio": [],
        "pit_times": [],
        "timing_stats": {},
        "commentary": None,
        "championship": None,
        "track": {"x": [], "y": []},
        "next_session": _next_upcoming(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


_track_cache = {}
_track_loading = set()
_track_cache_lock = threading.Lock()
TRACK_RETRY_SECONDS = 300


def _get_track_geometry(year, round_num, session_type, event_name=None):
    if not year or not round_num:
        return {"x": [], "y": []}

    key = f"{year}_{round_num}_{session_type}"
    now = time.monotonic()
    with _track_cache_lock:
        entry = _track_cache.get(key)
        if entry is not None and (entry["data"]["x"] or now - entry["ts"] < TRACK_RETRY_SECONDS):
            return entry["data"]
        if key in _track_loading:
            return entry["data"] if entry else {"x": [], "y": []}
        _track_loading.add(key)
        current = entry["data"] if entry else {"x": [], "y": []}

    threading.Thread(
        target=_load_geometry_async,
        args=(key, year, round_num, session_type, event_name),
        daemon=True,
    ).start()
    return current


def _load_geometry_async(key, year, round_num, session_type, event_name):
    data = {"x": [], "y": []}
    try:
        data = _load_track_geometry(year, round_num, session_type)
        if not data["x"] and event_name:
            data = _load_prior_geometry(event_name, year)
    except Exception:
        logger.exception("Track geometry load failed")
    with _track_cache_lock:
        _track_cache[key] = {"data": data, "ts": time.monotonic()}
        _track_loading.discard(key)


def _load_prior_geometry(event_name, year):
    for prev_year in range(year - 1, year - 4, -1):
        for stype in ("R", "Q"):
            try:
                geo = _load_track_geometry(prev_year, event_name, stype)
            except Exception:
                geo = {"x": [], "y": []}
            if geo["x"]:
                return geo
    return {"x": [], "y": []}


def _load_track_geometry(year, round_num, session_type):
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

        sector_markers = []
        try:
            if "SessionTime" in lap_tel:
                sess_arr = lap_tel["SessionTime"].dt.total_seconds().to_numpy()
                for col in ("Sector1SessionTime", "Sector2SessionTime"):
                    st = fastest_lap.get(col)
                    if st is None or not pd.notna(st):
                        continue
                    target = pd.Timedelta(st).total_seconds()
                    j = int(np.nanargmin(np.abs(sess_arr - target)))
                    if not (np.isnan(tx[j]) or np.isnan(ty[j])):
                        sector_markers.append({"x": int(round(float(tx[j]))), "y": int(round(float(ty[j])))})
        except Exception:
            sector_markers = []

        return {
            "x": [int(round(float(v))) for v in tx[mask]],
            "y": [int(round(float(v))) for v in ty[mask]],
            "sector_markers": sector_markers,
        }
    except Exception as e:
        logger.warning(f"Could not load track geometry for {year}/{round_num}/{session_type}: {e}")
        return {"x": [], "y": []}



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


def _parse_hms(text):
    parts = str(text).split(":")
    try:
        nums = [float(p) for p in parts]
    except ValueError:
        return None
    seconds = 0.0
    for n in nums:
        seconds = seconds * 60 + n
    return seconds


def _format_hms(seconds):
    seconds = int(max(0, round(seconds)))
    hours, rem = divmod(seconds, 3600)
    minutes, secs = divmod(rem, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def _parse_utc(text):
    text = str(text).strip().replace("Z", "+00:00")
    if "." in text:
        head, _, tail = text.partition(".")
        frac = tail
        tz = ""
        for marker in ("+", "-"):
            idx = tail.find(marker)
            if idx != -1:
                frac, tz = tail[:idx], tail[idx:]
                break
        frac = frac[:6]
        text = f"{head}.{frac}{tz}"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _extrapolated_remaining(clock):
    remaining = _clean(clock.get("Remaining"))
    if not remaining:
        return None
    if not clock.get("Extrapolating"):
        return remaining
    base = _parse_hms(remaining)
    ref = _parse_utc(clock.get("Utc")) if clock.get("Utc") else None
    if base is None or ref is None:
        return remaining
    elapsed = (datetime.now(timezone.utc) - ref).total_seconds()
    return _format_hms(base - elapsed)


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


def live_raw():
    if _test_mode:
        return _live_raw_test()
    return _manager.raw_topics()


def _live_raw_test():
    test_file = os.environ.get("F1_LIVE_TEST_FILE", "/tmp/test_live_data.txt")
    topics = {}
    if os.path.exists(test_file):
        with open(test_file, "r") as handle:
            for line in handle:
                parsed = _parse_line(line)
                if parsed is None:
                    continue
                topic, payload = parsed
                current = topics.get(topic)
                if isinstance(payload, dict):
                    topics[topic] = _merge(current if isinstance(current, dict) else {}, payload)
                else:
                    topics[topic] = payload
    return {
        "available": bool(topics),
        "source": "test",
        "session_key": None,
        "topics": topics,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _live_state_test():
    import ast

    test_file = os.environ.get("F1_LIVE_TEST_FILE", "/tmp/test_live_data.txt")
    if not os.path.exists(test_file):
        return _no_session_snapshot()

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
        return _no_session_snapshot()

    return _live_snapshot(topics)
