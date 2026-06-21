# PrimeClip

Local-first, AI-powered video clipping tool. Turn long-form video into vertical Shorts/Reels/TikTok clips using Claude, OpenAI, OpenRouter, or local Ollama.

## Features

- Upload long-form video → automatic clip generation
- Pipeline: audio extract → Whisper transcription → scene detection → LLM clip selection → face tracking → vertical crop → captions → motion → FFmpeg render
- Pluggable LLM providers (Ollama, Claude, OpenAI, OpenRouter, custom OpenAI-compatible APIs)
- Tauri desktop app (macOS, Windows, Linux) with OS keychain for API keys
- **Full** and **Lite** distribution variants

## Prerequisites

- Python 3.12+
- [uv](https://github.com/astral-sh/uv)
- Node.js 20+
- Rust (for Tauri)
- FFmpeg 6+ with libass
- Ollama (optional, for local LLM)

## Quick Start (Development)

```bash
# Install backend deps
uv sync --all-extras

# Install frontend deps
cd apps/desktop && npm install && cd ../..

# Copy env
cp .env.example .env

# Terminal 1 — API
make dev-api

# Terminal 2 — Desktop UI
make dev-desktop
```

API docs: http://127.0.0.1:8765/docs (when `PRIMECLIP_DEBUG=true`)

## Which build should I download?

| Variant | Best for | Includes |
|---------|----------|----------|
| **Full** | Creators wanting one-click setup | Bundled FFmpeg, Whisper `base` model |
| **Lite** | Developers with existing toolchain | App + Python sidecar only; uses system FFmpeg |

Ollama is never bundled — install separately for local LLM.

## Project Structure

```
backend/          FastAPI sidecar + pipeline services
apps/desktop/     Tauri 2 + React UI
scripts/          Build & dependency scripts
resources/        Vendored binaries (Full builds)
outputs/          Runtime uploads, artifacts, clips (gitignored)
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health + dependency status |
| GET | `/api/providers` | List LLM providers |
| POST | `/api/providers/test` | Test provider connection |
| POST | `/api/upload` | Upload video |
| POST | `/api/generate-clips` | Start clip generation job |
| GET | `/api/jobs/{id}` | Job progress |
| GET | `/api/clips/{video_id}` | List clips |
| GET | `/api/download/{clip_id}` | Download MP4 |

## Testing

```bash
make test
make lint
make check-deps
```

## Building Releases

```bash
make bundle-backend   # PyInstaller sidecar
make build-lite       # Lite desktop build
make build-full       # Full desktop build (vendored FFmpeg)
```

## License

MIT — see [LICENSE](LICENSE)
