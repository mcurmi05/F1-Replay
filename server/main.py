import os
import sys
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastf1.exceptions import RateLimitExceededError
from pydantic import BaseModel

import f1data

app = FastAPI(title="F1 Replay API")

origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


class CacheRequest(BaseModel):
    dir: str


def _require_cache():
    if f1data.get_cache() is None:
        raise HTTPException(status_code=409, detail="No cache folder selected")


def _load(year, event, session_type):
    _require_cache()
    try:
        return f1data.load_session(year, event, session_type)
    except RateLimitExceededError:
        raise HTTPException(status_code=429, detail="FastF1 rate limit reached, try again later")


@api.get("/cache")
def cache_status():
    return {"dir": f1data.get_cache()}


@api.post("/cache")
def set_cache_dir(request: CacheRequest):
    f1data.set_cache(request.dir)
    return {"dir": f1data.get_cache()}


@api.get("/schedule/{year}")
def schedule(year: int):
    _require_cache()
    return f1data.get_schedule(year)


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
    return f1data.build_replay(loaded, step=step)


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
