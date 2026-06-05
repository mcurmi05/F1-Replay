$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

npm --prefix .. run build

.\.venv\Scripts\pyinstaller.exe --noconfirm --onedir --name f1-replay `
  --distpath dist_app --workpath build_tmp --specpath . `
  --add-data "../dist;dist" `
  --collect-all fastf1 `
  --collect-submodules uvicorn `
  launcher.py

Write-Host "Built dist_app/f1-replay/f1-replay.exe"
