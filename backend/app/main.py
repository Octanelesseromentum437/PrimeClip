import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.captions import router as captions_router
from app.api.routes.clips import download_router
from app.api.routes.clips import router as clips_router
from app.api.routes.jobs import jobs_router
from app.api.routes.jobs import router as generate_router
from app.api.routes.providers import health_router
from app.api.routes.providers import router as providers_router
from app.api.routes.upload import router as upload_router
from app.api.routes.videos import router as videos_router
from app.config import get_settings
from app.db.session import init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    init_db(settings)
    logger.info("PrimeClip API started (profile=%s)", settings.bundle_profile.value)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="PrimeClip API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.primeclip_debug else None,
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:1420", "http://127.0.0.1:1420", "tauri://localhost"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router, prefix="/api")
    app.include_router(upload_router, prefix="/api")
    app.include_router(videos_router, prefix="/api")
    app.include_router(generate_router, prefix="/api")
    app.include_router(jobs_router, prefix="/api")
    app.include_router(clips_router, prefix="/api")
    app.include_router(captions_router, prefix="/api")
    app.include_router(download_router, prefix="/api")
    app.include_router(providers_router, prefix="/api")

    return app


app = create_app()
