#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
uv run pyinstaller --clean --noconfirm ../backend/bundle.spec 2>/dev/null || \
  uv run pyinstaller --clean --noconfirm \
    --name primeclip-api \
    --onefile \
    --paths . \
    --hidden-import=app \
    app/main.py
