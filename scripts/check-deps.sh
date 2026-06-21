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

if command -v ffmpeg >/dev/null 2>&1; then
  if ffmpeg -h filter=ass 2>&1 | grep -q "Unknown filter"; then
    echo "✗ FFmpeg (missing libass — brew install ffmpeg-full on macOS)"
  else
    echo "✓ FFmpeg (with libass)"
  fi
else
  echo "✗ FFmpeg (missing: ffmpeg)"
fi
check "Node" node
check "uv" uv
check "cargo" cargo

if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "✓ Ollama (localhost:11434)"
else
  echo "○ Ollama (optional, not running)"
fi
