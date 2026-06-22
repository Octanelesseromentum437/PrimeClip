import asyncio
from pathlib import Path

from app.api.deps import get_ffmpeg_service
from app.api.routes.upload import UploadResponse, _register_uploaded_video
from app.config import get_settings
from app.db.session import get_engine
from app.infra.ffmpeg import FFmpegService
from app.services.url_import.url_import import ImportJobState, UrlImportService
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl
from sqlmodel import Session

router = APIRouter(prefix="/upload", tags=["import"])

_service = UrlImportService(get_settings())


class UrlImportRequest(BaseModel):
    url: HttpUrl


class UrlImportStartResponse(BaseModel):
    import_id: str
    status: str


class UrlImportStatusResponse(BaseModel):
    import_id: str
    status: str
    progress_pct: int
    video_id: str | None = None
    filename: str | None = None
    error_message: str | None = None


def _to_status(job: ImportJobState) -> UrlImportStatusResponse:
    return UrlImportStatusResponse(
        import_id=job.id,
        status=job.status,
        progress_pct=job.progress_pct,
        video_id=job.video_id,
        filename=job.filename,
        error_message=job.error_message,
    )


@router.post("/url", response_model=UrlImportStartResponse)
async def import_from_url(
    body: UrlImportRequest,
    ffmpeg: FFmpegService = Depends(get_ffmpeg_service),
) -> UrlImportStartResponse:
    if not _service.check_available():
        raise HTTPException(status_code=503, detail="yt-dlp is not available")

    url = str(body.url)
    try:
        job = _service.start_import(url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    async def register_video(*, video_id: str, path: Path, filename: str) -> UploadResponse:
        with Session(get_engine()) as bg_session:
            return _register_uploaded_video(
                session=bg_session,
                ffmpeg=ffmpeg,
                video_id=video_id,
                path=path,
                filename=filename,
                source_url=url,
                source_provider=_provider_for_url(url),
            )

    asyncio.create_task(_service.run_import(job, register_video=register_video))
    return UrlImportStartResponse(import_id=job.id, status=job.status)


@router.get("/url/{import_id}", response_model=UrlImportStatusResponse)
def get_import_status(import_id: str) -> UrlImportStatusResponse:
    job = _service.get_job(import_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    return _to_status(job)


def _provider_for_url(url: str) -> str:
    if "drive.google.com" in url:
        return "google_drive"
    if "youtube.com" in url or "youtu.be" in url:
        return "youtube"
    if "vimeo.com" in url:
        return "vimeo"
    return "url"
