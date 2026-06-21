#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export BUNDLE_PROFILE=lite
"$ROOT/scripts/bundle-backend.sh"
cd "$ROOT/apps/desktop"
npm run tauri build
