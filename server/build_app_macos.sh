#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

npm --prefix .. run build

.venv/bin/pyinstaller --noconfirm --onedir --name f1-replay \
  --distpath dist_app --workpath build_tmp --specpath . \
  --add-data "../dist:dist" \
  --collect-all fastf1 \
  --collect-submodules uvicorn \
  launcher.py

echo "Built dist_app/f1-replay/f1-replay"
