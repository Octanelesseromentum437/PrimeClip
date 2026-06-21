from collections.abc import Generator

from app.config import get_settings
from app.db.session import get_session
from app.infra.dependencies import DependencyResolver
from app.infra.ffmpeg import FFmpegService
from app.infra.storage import FileStore
from app.jobs.runner import get_job_runner
from app.providers.registry import ProviderRegistry
from sqlmodel import Session


def get_dependency_resolver() -> DependencyResolver:
    return DependencyResolver(get_settings())


def get_file_store() -> FileStore:
    return FileStore(get_settings())


def get_ffmpeg_service() -> FFmpegService:
    return FFmpegService(get_dependency_resolver())


def get_provider_registry() -> ProviderRegistry:
    return ProviderRegistry(get_settings())


def get_db_session() -> Generator[Session, None, None]:
    yield from get_session()
