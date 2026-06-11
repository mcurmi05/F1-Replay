import json
import os
import re
import shutil
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastf1.exceptions import RateLimitExceededError
from pydantic import BaseModel

import f1data
import live
import liveauth

app = FastAPI(title="F1 Replay API")

origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")

# When ADMIN_TOKEN is set (hosted deployments) the endpoints that change the
# server's F1TV credentials require a matching X-Admin-Token header, so a public
# visitor cannot sign the shared session out or overwrite its token. When it is
# unset (desktop and dev) those endpoints stay open and the normal sign-in flow
# works unchanged.
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "").strip()


def require_admin(x_admin_token: str | None = Header(default=None)):
    if not ADMIN_TOKEN:
        return
    if x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Admin access required")


class CacheRequest(BaseModel):
    dir: str
    delete_previous: bool = False


class SaveLayoutRequest(BaseModel):
    name: str
    layout: list
    hidden_panels: list[str] = []
    timing_columns: list | None = None
    cols: int | None = None


class UpdateLayoutRequest(BaseModel):
    name: str | None = None
    layout: list | None = None
    hidden_panels: list[str] | None = None
    timing_columns: list | None = None
    cols: int | None = None


class SetTokenRequest(BaseModel):
    token: str


LAYOUT_CATEGORY_DIRS = {
    "practice": ("practice",),
    "qualifying": ("qualifying",),
    "race": ("race",),
    "live-practice": ("live", "practice"),
    "live-qualifying": ("live", "qualifying"),
    "live-race": ("live", "race"),
}


def _layouts_dir(category: str):
    cache = f1data.get_cache()
    if not cache:
        raise HTTPException(status_code=409, detail="No cache folder selected")
    parts = LAYOUT_CATEGORY_DIRS.get((category or "").lower())
    if not parts:
        raise HTTPException(status_code=400, detail="Invalid layout category")
    d = Path(cache, "layouts", *parts)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _sanitize_name(name: str) -> str:
    safe = re.sub(r'[/\\:*?"<>|\x00]', '', name).strip().strip('.')
    if not safe:
        raise HTTPException(status_code=400, detail="Invalid layout name")
    return safe


def _is_within(child, parent):
    try:
        common = os.path.commonpath([os.path.abspath(child), os.path.abspath(parent)])
    except ValueError:
        return False
    return common == os.path.abspath(parent)


def _delete_previous_cache(previous, new_dir):
    if not previous:
        return False
    previous_abs = os.path.abspath(previous)
    new_abs = os.path.abspath(new_dir)
    if previous_abs == new_abs:
        return False
    if _is_within(new_abs, previous_abs):
        raise HTTPException(
            status_code=400,
            detail="New folder is inside the previous one, refusing to delete",
        )
    if os.path.dirname(previous_abs) == previous_abs:
        raise HTTPException(status_code=400, detail="Refusing to delete a filesystem root")
    if os.path.basename(previous_abs) != f1data.CACHE_FOLDER_NAME:
        return False
    if os.path.isdir(previous_abs):
        shutil.rmtree(previous_abs, ignore_errors=True)
        return True
    return False


def _require_cache():
    if not f1data.cache_valid():
        raise HTTPException(status_code=409, detail="No cache folder selected")


def _load(year, event, session_type):
    _require_cache()
    try:
        return f1data.load_session(year, event, session_type)
    except RateLimitExceededError:
        raise HTTPException(status_code=429, detail="FastF1 rate limit reached, try again later")


@api.get("/cache")
def cache_status():
    f1data.cache_valid()
    return {"dir": f1data.get_cache(), "deleted": f1data.cache_was_deleted()}


@api.post("/cache")
def set_cache_dir(request: CacheRequest):
    previous = f1data.get_cache()
    f1data.set_cache(request.dir)
    deleted = False
    if request.delete_previous:
        deleted = _delete_previous_cache(previous, f1data.get_cache())
    return {"dir": f1data.get_cache(), "previous": previous, "deleted": deleted}


@api.get("/years")
def years():
    from datetime import datetime
    current = datetime.now().year
    return list(range(current, 2017, -1))


@api.get("/live")
def live_status():
    return live.live_state()


@api.get("/live/raw")
def live_raw():
    return live.live_raw()


@api.get("/live/auth")
def live_auth_status():
    return liveauth.status()


@api.post("/live/auth/login", dependencies=[Depends(require_admin)])
def live_auth_login():
    return liveauth.start_login()


@api.post("/live/auth/logout", dependencies=[Depends(require_admin)])
def live_auth_logout():
    return liveauth.logout()


@api.post("/live/auth/token", dependencies=[Depends(require_admin)])
def live_auth_set_token(request: SetTokenRequest):
    try:
        return liveauth.set_token(request.token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@api.get("/schedule/{year}")
def schedule(year: int):
    _require_cache()
    try:
        return f1data.get_schedule(year)
    except RateLimitExceededError:
        raise HTTPException(status_code=429, detail="FastF1 rate limit reached, try again later")
    except Exception:
        raise HTTPException(status_code=503, detail="Schedule data is temporarily unavailable, please try again")


@api.get("/session/{year}/{event}/{session_type}/cached")
def session_cached(year: int, event: str, session_type: str):
    _require_cache()
    return {"cached": f1data.is_session_cached(year, event, session_type)}


@api.get("/session/{year}/{event}/{session_type}/available")
def session_available(year: int, event: str, session_type: str):
    _require_cache()
    try:
        return {"available": f1data.replay_available(year, event, session_type)}
    except RateLimitExceededError:
        raise HTTPException(status_code=429, detail="FastF1 rate limit reached, try again later")


@api.get("/session/{year}/{event}/{session_type}")
def session(year: int, event: str, session_type: str):
    loaded = _load(year, event, session_type)
    return {
        "summary": f1data.session_summary(loaded),
        "results": f1data.results(loaded),
        "laps": f1data.laps(loaded),
    }


@api.get("/session/{year}/{event}/{session_type}/telemetry/{driver}")
def telemetry(year: int, event: str, session_type: str, driver: str):
    loaded = _load(year, event, session_type)
    return f1data.driver_telemetry(loaded, driver)


@api.get("/session/{year}/{event}/{session_type}/replay")
def replay(year: int, event: str, session_type: str, step: float = 0.5):
    loaded = _load(year, event, session_type)
    try:
        return f1data.build_replay(loaded, step=step)
    except f1data.ReplayTimingError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@api.get("/layouts/{category}")
def list_layouts(category: str):
    d = _layouts_dir(category)
    results = []
    for f in sorted(d.glob("*.json"), key=lambda p: p.stat().st_mtime):
        try:
            name = json.loads(f.read_text(encoding="utf-8")).get("name", f.stem)
            results.append({"id": name, "name": name})
        except Exception:
            pass
    return results


@api.get("/layouts/{category}/{layout_name:path}")
def get_layout(category: str, layout_name: str):
    name = _sanitize_name(layout_name)
    d = _layouts_dir(category)
    f = d / f"{name}.json"
    if not f.exists():
        raise HTTPException(status_code=404, detail="Layout not found")
    return json.loads(f.read_text(encoding="utf-8"))


@api.post("/layouts/{category}")
def save_layout(category: str, request: SaveLayoutRequest):
    d = _layouts_dir(category)
    name = _sanitize_name(request.name)
    f = d / f"{name}.json"
    if f.exists():
        raise HTTPException(status_code=409, detail="A layout with that name already exists")
    data = {
        "name": name,
        "layout": request.layout,
        "hiddenPanels": request.hidden_panels,
        "timingColumns": request.timing_columns,
        "cols": request.cols,
    }
    f.write_text(json.dumps(data), encoding="utf-8")
    return {"id": name, "name": name}


@api.put("/layouts/{category}/{layout_name:path}")
def update_layout(category: str, layout_name: str, request: UpdateLayoutRequest):
    old_name = _sanitize_name(layout_name)
    d = _layouts_dir(category)
    old_file = d / f"{old_name}.json"
    if not old_file.exists():
        raise HTTPException(status_code=404, detail="Layout not found")
    data = json.loads(old_file.read_text(encoding="utf-8"))
    if request.layout is not None:
        data["layout"] = request.layout
    if request.cols is not None:
        data["cols"] = request.cols
    if request.hidden_panels is not None:
        data["hiddenPanels"] = request.hidden_panels
    if request.timing_columns is not None:
        data["timingColumns"] = request.timing_columns
    elif request.layout is not None:
        data["timingColumns"] = None
    if request.name is not None:
        new_name = _sanitize_name(request.name)
        new_file = d / f"{new_name}.json"
        if new_name != old_name:
            if new_file.exists():
                raise HTTPException(status_code=409, detail="A layout with that name already exists")
            old_file.unlink()
        data["name"] = new_name
        new_file.write_text(json.dumps(data), encoding="utf-8")
        return {"id": new_name, "name": new_name}
    old_file.write_text(json.dumps(data), encoding="utf-8")
    return {"id": old_name, "name": old_name}


@api.delete("/layouts/{category}/{layout_name:path}")
def delete_layout(category: str, layout_name: str):
    name = _sanitize_name(layout_name)
    d = _layouts_dir(category)
    f = d / f"{name}.json"
    if f.exists():
        f.unlink()
    return {"ok": True}


app.include_router(api)


def _static_dir():
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", ".")) / "dist"
    return Path(__file__).resolve().parent.parent / "dist"


STATIC_DIR = _static_dir()

if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404)
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
