<img width="1920" height="927" alt="Screenshot 2026-06-29 at 1 12 12 pm" src="https://github.com/user-attachments/assets/51460017-611f-4b66-a4d6-a77ccec580bc" />
<img width="1920" height="928" alt="Screenshot 2026-06-29 at 1 13 01 pm" src="https://github.com/user-attachments/assets/ed522954-6317-410e-9d6c-f352c1d7cc4f" />

# F1 Replay

A dashboard for replaying live and past Formula 1 sessions: live timing, track maps, tyre strategy and lap by lap telemetry, powered by the [FastF1 Python package](https://github.com/theOehrly/Fast-F1).

Live demo (ran on my AWS lightsail instance): https://f1-live.charliedogdingus.com

## Tech stack

- Frontend: Vite + React + TypeScript, Tailwind CSS v4, React Router, react grid layout for the draggable panel grid, hls.js for commentary audio.
- Backend: FastAPI on uvicorn (Python), wrapping FastF1 for historical data and a SignalR client for live timing.
- Data: FastF1 for historical sessions and telemetry, the Formula 1 SignalR feed for live timing.

## How it works

The app has two halves that share one UI.

Replay picks a season, event and session and loads it through FastF1. The backend extracts timing, car positions, telemetry, tyre stints, race control messages and weather, caches the result on disk, and returns one JSON payload the frontend replays against a scrubbable clock.

Live mirrors a session in progress. A single backend process opens one connection to the F1 SignalR feed, decodes the streamed topics (timing, car positions, car telemetry, race control, team radio, weather, commentary), and keeps the latest state in memory. Every visitor polls that shared state over HTTP, so no visitor needs an F1TV login. Car positions and telemetry are the only topics F1 gates behind a paid F1TV subscription. The operator sets one F1TV token server side and those panels unlock for everyone (PERSONAL USE ONLY).

The frontend builds to static files (dist/) that FastAPI serves directly, so in production the page and the /api/* endpoints are same origin on one process. In development Vite serves the frontend with hot reload and proxies /api to the backend.

### Backend (server/)

- main.py - the FastAPI app: REST routes under /api, the saved layout store, and static serving of the built frontend as a single-page app.
- f1data.py - FastF1 wrapper: schedule, session loading, telemetry, replay payload assembly, and the on disk cache.
- live.py - the live manager: one persistent SignalR connection, topic decoding, and the in memory live snapshot.
- liveauth.py - the F1TV token flow that unlocks the auth-gated live panels.
- launcher.py - process entrypoint: configures SSL certificates, then runs uvicorn.

### Frontend (src/)

- pages/ - Home (session picker), Live, Replay, Admin (operator token console).
- components/replay/ and components/live/ - the panels: timing tower, track map, telemetry, race control, tyre strategy, standings and more.
- hooks/ - data fetching and the persisted, draggable layout system.
- lib/api/ - the typed API client. In a hosted build, layout storage is redirected to per-browser localStorage so visitors do not share one set.

### Routes

Frontend: /home, /live, /replay/:year/:event/:session, /admin.

API (prefixed with /api): /years, /schedule/{year}, /session/{year}/{event}/{type} and its /cached, /available, /replay and /telemetry/{driver} variants, /live, /live/raw, /live/auth with /login, /logout and /token, /cache, and /layouts/{category}.

## Running locally

Start the backend:

    cd server
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
    .venv/bin/python launcher.py

It serves on http://127.0.0.1:8000 and opens a browser unless F1_NO_BROWSER is set.

In a second terminal start the Vite dev server, which hot reloads the frontend and proxies /api to the backend:

    npm install
    npm run dev

The dev UI runs on http://localhost:5173.

For a production like run, build the frontend once and let the backend serve it directly:

    npm run build

Then start the backend as above, it serves both the page and the API on port 8000.

The first load of a replay session downloads it through FastF1 and caches it on disk (under FASTF1_CACHE_DIR when set, otherwise the platform cache directory), so later loads are fast.

## Deployment

The live page runs as a public webapp behind Caddy and systemd on a small Linux box. One server holds a single F1TV token and fans the live feed out to all visitors (PERSONAL USE) only the operator, holding ADMIN_TOKEN, can set or clear that token at /admin.

- `HOSTED=true npm run build` hides the operator only F1TV controls and routes layout storage to each visitor's browser.
- uvicorn runs launcher.py on 127.0.0.1:8000, Caddy terminates TLS on 443 and reverse proxies to it.
- ADMIN_TOKEN gates the /admin console and the token-mutating API endpoints.
- FASTF1_CACHE_DIR locks the cache to an operator-managed path; an hourly systemd timer prunes it once it grows past CACHE_MAX_GB.
- The F1TV subscription token lasts about four days, when it lapses the gated panels show a passive notice and the free panels keep working.
- `sudo /opt/f1-replay/deploy/update.sh` redeploys in one step: pull, rebuild the hosted frontend, refresh Python deps and the systemd units, restart.

Full step by step instructions, the systemd units, the Caddyfile and the environment template are in [deploy/README.md](deploy/README.md).
