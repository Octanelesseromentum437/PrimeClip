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

TARGET="$(rustc --print host-tuple)"
BIN_DIR="$ROOT/apps/desktop/src-tauri/binaries"
mkdir -p "$BIN_DIR"

if [[ "$TARGET" == *windows* ]]; then
  cp dist/primeclip-api.exe "$BIN_DIR/primeclip-api-${TARGET}.exe"
  chmod +x "$BIN_DIR/primeclip-api-${TARGET}.exe"
else
  cp dist/primeclip-api "$BIN_DIR/primeclip-api-${TARGET}"
  chmod +x "$BIN_DIR/primeclip-api-${TARGET}"
fi

echo "Bundled sidecar -> $BIN_DIR/primeclip-api-${TARGET}"
