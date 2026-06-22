.PHONY: dev dev-api dev-desktop test lint install check-deps bundle-backend build-lite build-full

install:
	uv sync --all-extras
	cd apps/desktop && npm install

dev-api:
	PYTHONPATH=backend uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8765

dev-desktop:
	cd apps/desktop && npm run tauri dev

dev:
	@echo "Run 'make dev-api' and 'make dev-desktop' in separate terminals"

test:
	PYTHONPATH=backend uv run pytest backend/tests -v
	cd apps/desktop && npm run test:coverage

lint:
	PYTHONPATH=backend uv run ruff check backend/app backend/tests
	PYTHONPATH=backend uv run ruff format --check backend/app backend/tests

check-deps:
	./scripts/check-deps.sh

bundle-backend:
	./scripts/bundle-backend.sh

build-lite:
	./scripts/build-lite.sh

build-full:
	./scripts/build-full.sh
