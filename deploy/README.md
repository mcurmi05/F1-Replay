# Hosting the live page

This deploys the live timing page as a public webapp. One server holds a single
F1TV subscription token and connects once to the F1 SignalR feed. every visitor
reads that shared feed over HTTP and needs no F1TV login of their own. Only the
operator, holding the admin secret, can set or clear the server token. (ONLY FOR PERSONAL USE)

## Architecture

- uvicorn serves the FastAPI app and the built frontend on 127.0.0.1:8000.
- Caddy terminates TLS on 443 and reverse proxies to uvicorn.
- One process wide live manager keeps one upstream SignalR connection in memory.
- Auth is global server state: when the server token is valid, all gated panels
  (track map, telemetry, standings) unlock for every visitor.

## How I'm hosting it

- Lightsail instance, Ubuntu 24.04, with a static IP.
- DNS A record for the subdomain pointing at the static IP, with the Cloudflare
  proxy disabled (grey cloud) so Caddy can complete the TLS challenge.
- Lightsail firewall open on TCP 22, 80, and 443.

## Build the frontend

The hosted build hides the operator only F1TV controls. Build on the server or
build locally and copy the dist directory up.

    HOSTED=true npm install
    HOSTED=true npm run build

This produces dist/ at the repository root, which the server serves directly.

## Install on the server

    sudo mkdir -p /opt/f1-replay /var/lib/f1-replay/cache
    # Place the repository (including the built dist/) at /opt/f1-replay
    cd /opt/f1-replay
    python3 -m venv .venv
    .venv/bin/pip install -r server/requirements.txt

Create the service user and grant cache ownership:

    sudo useradd --system --no-create-home f1replay
    sudo chown -R f1replay:f1replay /var/lib/f1-replay /opt/f1-replay

## Configure

    cp deploy/f1-replay.env.example deploy/f1-replay.env
    # Edit deploy/f1-replay.env: set ADMIN_TOKEN to a long random string and
    # set CORS_ORIGINS to the public origin.

## Run as a service

    sudo cp deploy/f1-replay.service /etc/systemd/system/f1-replay.service
    sudo systemctl daemon-reload
    sudo systemctl enable --now f1-replay
    systemctl status f1-replay

## TLS front

    sudo apt install caddy
    # Edit deploy/Caddyfile: replace f1.example.com with the real subdomain.
    sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
    sudo systemctl reload caddy

## Set the server token

1. Open https://SUBDOMAIN/admin and enter the ADMIN_TOKEN.
2. Follow the bookmarklet steps to copy an F1TV token from f1tv.com.
3. Paste the token and set it. The gated panels unlock for all visitors.

## Cache size cap

The replay feature caches each loaded session under FASTF1_CACHE_DIR. To stop it
filling the disk, an hourly timer prunes the oldest sessions once the cache
passes CACHE_MAX_GB (default 30). The live page itself barely uses this cache.

    chmod +x deploy/prune-cache.sh
    sudo cp deploy/f1-replay-prune.service /etc/systemd/system/
    sudo cp deploy/f1-replay-prune.timer /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable --now f1-replay-prune.timer

Check it: systemctl list-timers f1-replay-prune. Run a prune by hand any time
with: sudo systemctl start f1-replay-prune, then journalctl -u f1-replay-prune.

## Token refresh

The F1TV subscription token lasts about four days. When it lapses the gated
panels show a passive "temporarily unavailable" notice. Repeat the set-token
step at /admin to restore them. The free panels (timing tower, race control,
weather) keep working without a token.
