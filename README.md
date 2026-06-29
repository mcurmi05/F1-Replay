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

## Running with Docker

The prebuilt image is on Docker Hub as `mcurmi05/f1-replay`. Save this as `docker-compose.yml`:

```yaml
services:
  f1-replay:
    image: mcurmi05/f1-replay:latest
    container_name: f1-replay
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      # Required only to unlock the live gated panels at /admin (see below).
      - ADMIN_TOKEN=change-me-to-a-long-random-string
    volumes:
      # Persist the FastF1 session cache across restarts.
      - f1-cache:/data/cache

volumes:
  f1-cache:
```

Then start it:

    docker compose up -d

Open http://localhost:8000. The FastF1 cache lives on the `f1-cache` volume, so replay sessions stay cached across restarts. Update later with `docker compose pull && docker compose up -d`.

### Unlocking the live gated panels (F1TV token)

Replay and the free live panels (timing tower, race control, weather) work with no login. Live car positions and telemetry (track map, standings) are gated by F1 behind a paid F1TV subscription. The server holds one token and unlocks those panels for everyone (PERSONAL USE ONLY).

1. Set `ADMIN_TOKEN` in `.env` to a long random string before starting the container.
2. Open http://localhost:8000/admin and enter that `ADMIN_TOKEN`.
3. Follow the on-screen bookmarklet steps to copy an F1TV token from f1tv.com (requires an active F1TV subscription).
4. Paste the token and set it. The gated live panels unlock.

The F1TV token lasts about four days. When it lapses the gated panels show a passive "temporarily unavailable" notice; repeat steps 2-4 at /admin to restore them. The free panels keep working without a token.

Common commands:

    docker compose logs -f        # follow logs
    docker compose down           # stop and remove the container
    docker compose up -d --build  # rebuild after pulling updates

To build the image yourself from a clone of this repo (for example the public, multi-visitor variant that hides the operator-only F1TV controls), set the `HOSTED` build arg and point the compose `image:` at your own tag, or build directly:

    docker build --build-arg HOSTED=true -t mcurmi05/f1-replay .
