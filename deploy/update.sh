#!/usr/bin/env bash
# One-shot redeploy: pull the latest code, rebuild the hosted frontend, refresh
# Python deps and the systemd units, fix ownership, and restart the service.
# Run from anywhere with: sudo /opt/f1-replay/deploy/update.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "run with sudo: sudo $0" >&2
  exit 1
fi

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_USER=f1replay
STATE_DIR=/var/lib/f1-replay

echo "==> Pulling latest code in $REPO"
git -C "$REPO" -c safe.directory="$REPO" pull --ff-only

echo "==> Building hosted frontend"
cd "$REPO"
HOSTED=true npm install
HOSTED=true npm run build

echo "==> Updating Python dependencies"
"$REPO/.venv/bin/pip" install -r "$REPO/server/requirements.txt"

echo "==> Installing systemd units"
chmod +x "$REPO/deploy/prune-cache.sh"
cp "$REPO/deploy/f1-replay.service" /etc/systemd/system/
cp "$REPO/deploy/f1-replay-prune.service" /etc/systemd/system/
cp "$REPO/deploy/f1-replay-prune.timer" /etc/systemd/system/
systemctl daemon-reload

echo "==> Restoring ownership to $SERVICE_USER"
chown -R "$SERVICE_USER:$SERVICE_USER" "$REPO" "$STATE_DIR"

echo "==> Restarting services"
systemctl restart f1-replay
systemctl enable --now f1-replay-prune.timer

echo "==> Done. Status:"
systemctl --no-pager --lines=0 status f1-replay || true
