#!/usr/bin/env bash
set -euo pipefail

check() {
  local name="$1"
  local cmd="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "✓ $name"
  else
    echo "✗ $name (missing: $cmd)"
  fi
}

check "FFmpeg" ffmpeg
check "Node" node
check "uv" uv
check "cargo" cargo

if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "✓ Ollama (localhost:11434)"
else
  echo "○ Ollama (optional, not running)"
fi
