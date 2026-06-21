#!/usr/bin/env bash
# Initialize PrimeClip repo with granular commit history.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

commit() {
  git add "$@"
  git commit -m "$MSG"
}

git init -b main

MSG="chore: add MIT license"
commit LICENSE

MSG="chore: add gitignore for Python, Node, and build artifacts"
commit .gitignore

MSG="chore: add Python project config and lockfile"
commit pyproject.toml uv.lock

MSG="chore: add environment variable example"
commit .env.example

MSG="docs: add project README"
commit README.md

MSG="chore: add Makefile with dev, test, and build targets"
commit Makefile

MSG="feat(backend): add application settings"
commit backend/app/config.py

MSG="feat(backend): add database models"
commit backend/app/db/models.py

MSG="feat(backend): add database session"
commit backend/app/db/session.py

MSG="feat(backend): add database repository"
commit backend/app/db/repository.py

MSG="feat(backend): add file storage utilities"
commit backend/app/infra/storage.py

MSG="feat(backend): add FFmpeg wrapper"
commit backend/app/infra/ffmpeg.py

MSG="feat(backend): add dependency health checks"
commit backend/app/infra/dependencies.py

MSG="feat(backend): add shared API schemas"
commit backend/app/schemas/common.py backend/app/schemas/dependencies.py

MSG="feat(backend): add clip and transcript schemas"
commit backend/app/schemas/clip.py backend/app/schemas/transcript.py

MSG="feat(backend): add scene and caption schemas"
commit backend/app/schemas/scene.py backend/app/schemas/caption.py

MSG="feat(backend): add crop, face, and motion schemas"
commit backend/app/schemas/crop.py backend/app/schemas/face.py backend/app/schemas/motion.py

MSG="feat(backend): add render and provider schemas"
commit backend/app/schemas/render.py backend/app/schemas/provider.py

MSG="feat(backend): add LLM provider base class"
commit backend/app/providers/base.py

MSG="feat(backend): add LLM provider registry"
commit backend/app/providers/registry.py

MSG="feat(backend): add JSON repair utilities for LLM output"
commit backend/app/providers/json_utils.py

MSG="feat(backend): add Ollama provider"
commit backend/app/providers/ollama.py

MSG="feat(backend): add Claude provider"
commit backend/app/providers/claude.py

MSG="feat(backend): add OpenAI-compatible provider"
commit backend/app/providers/openai_compat.py

MSG="feat(backend): add Gemini provider"
commit backend/app/providers/gemini.py

MSG="feat(backend): add audio extraction service"
commit backend/app/services/audio/extract.py

MSG="feat(backend): add Whisper transcription service"
commit backend/app/services/transcription/whisper.py

MSG="feat(backend): add histogram scene detection"
commit backend/app/services/scene_detection/histogram.py

MSG="feat(backend): add caption generator service"
commit backend/app/services/captions/generator.py

MSG="feat(backend): add MediaPipe face tracking"
commit backend/app/services/face_tracking/mediapipe_tracker.py

MSG="feat(backend): add dynamic vertical crop service"
commit backend/app/services/vertical_crop/dynamic_crop.py

MSG="feat(backend): add motion planner service"
commit backend/app/services/motion/planner.py

MSG="feat(backend): add FFmpeg render service"
commit backend/app/services/render/ffmpeg_renderer.py

MSG="feat(backend): add clip pipeline context"
commit backend/app/pipelines/context.py

MSG="feat(backend): add clip generation pipeline"
commit backend/app/pipelines/clip_pipeline.py

MSG="feat(backend): add LLM clip selection prompts"
commit backend/app/prompts/clip_selection_system.txt backend/app/prompts/clip_selection.txt

MSG="feat(backend): add background job runner"
commit backend/app/jobs/runner.py

MSG="feat(backend): add FastAPI application entrypoint"
commit backend/app/__init__.py backend/app/main.py

MSG="feat(backend): add provider API routes"
commit backend/app/api/routes/providers.py

MSG="feat(backend): add video upload API route"
commit backend/app/api/routes/upload.py

MSG="feat(backend): add job status API route"
commit backend/app/api/routes/jobs.py

MSG="feat(backend): add clips listing and download routes"
commit backend/app/api/routes/clips.py

MSG="feat(backend): add API dependency injection"
commit backend/app/api/deps.py

MSG="test(backend): add pytest fixtures"
commit backend/tests/conftest.py

MSG="test(backend): add JSON utils unit tests"
commit backend/tests/unit/test_json_utils.py

MSG="test(backend): add vertical crop unit tests"
commit backend/tests/unit/test_vertical_crop.py

MSG="test(backend): add API integration tests"
commit backend/tests/integration/test_api.py

MSG="test(backend): add pipeline integration tests"
commit backend/tests/integration/test_pipeline.py

MSG="chore(backend): add PyInstaller bundle spec"
commit backend/bundle.spec

MSG="chore: add backend bundle script"
commit scripts/bundle-backend.sh

MSG="chore(desktop): add Tauri and Cargo config"
commit apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/build.rs apps/desktop/src-tauri/tauri.conf.json

MSG="chore(desktop): add Tauri capabilities and icons"
commit apps/desktop/src-tauri/capabilities/default.json apps/desktop/src-tauri/icons/ apps/desktop/src-tauri/binaries/.gitkeep

MSG="feat(desktop): add Tauri main entrypoint"
commit apps/desktop/src-tauri/src/main.rs

MSG="feat(desktop): add Python sidecar process manager"
commit apps/desktop/src-tauri/src/sidecar.rs

MSG="feat(desktop): add OS keychain credential storage"
commit apps/desktop/src-tauri/src/credentials.rs

MSG="feat(desktop): add shared application state"
commit apps/desktop/src-tauri/src/state.rs

MSG="chore(desktop): add Vite, TypeScript, and Tailwind config"
commit apps/desktop/package.json apps/desktop/package-lock.json apps/desktop/vite.config.ts apps/desktop/tsconfig.json apps/desktop/tsconfig.node.json apps/desktop/tailwind.config.ts apps/desktop/postcss.config.js apps/desktop/index.html

MSG="chore(desktop): add React entrypoint and global styles"
commit apps/desktop/src/main.tsx apps/desktop/src/index.css apps/desktop/src/vite-env.d.ts

MSG="feat(desktop): add API client and shared types"
commit apps/desktop/src/lib/api.ts apps/desktop/src/lib/types.ts

MSG="feat(desktop): add credentials bridge for keychain"
commit apps/desktop/src/lib/credentials.ts

MSG="feat(desktop): add job polling hook"
commit apps/desktop/src/hooks/useJobPolling.ts

MSG="feat(desktop): add LLM providers hook"
commit apps/desktop/src/hooks/useProviders.ts

MSG="feat(desktop): add navigation component"
commit apps/desktop/src/components/Nav.tsx

MSG="feat(desktop): add clip card component"
commit apps/desktop/src/components/ClipCard.tsx

MSG="feat(desktop): add job progress component"
commit apps/desktop/src/components/JobProgress.tsx

MSG="feat(desktop): add upload page"
commit apps/desktop/src/pages/UploadPage.tsx

MSG="feat(desktop): add results page with notifications"
commit apps/desktop/src/pages/ResultsPage.tsx

MSG="feat(desktop): add settings page"
commit apps/desktop/src/pages/SettingsPage.tsx

MSG="feat(desktop): add app shell with routing"
commit apps/desktop/src/App.tsx

MSG="chore: add dependency check script"
commit scripts/check-deps.sh

MSG="chore: add lite desktop build script"
commit scripts/build-lite.sh

MSG="chore: add full desktop build script"
commit scripts/build-full.sh

MSG="chore: add FFmpeg bundle script"
commit scripts/bundle-ffmpeg.sh

MSG="chore: add vendored resource placeholders"
commit resources/ffmpeg/.gitkeep

MSG="ci: add backend and frontend test workflow"
commit .github/workflows/ci.yml

MSG="ci: add release build workflow"
commit .github/workflows/release.yml

echo "Done: $(git rev-list --count HEAD) commits on $(git branch --show-current)"
