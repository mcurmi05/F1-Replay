import os

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastf1.exceptions import RateLimitExceededError

import f1data

app = FastAPI(title="F1 Replay API")

origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


def _load(year, event, session_type):
    try:
        return f1data.load_session(year, event, session_type)
    except RateLimitExceededError:
        raise HTTPException(status_code=429, detail="FastF1 rate limit reached, try again later")


@api.get("/schedule/{year}")
def schedule(year: int):
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


app.include_router(api)
