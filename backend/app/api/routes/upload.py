from pathlib import Path

from app.api.deps import (
    get_db_session,
    get_ffmpeg_service,
    get_file_store,
)
from app.db.models import Video
from app.db.repository import VideoRepository
from app.infra.ffmpeg import FFmpegError, FFmpegService
from app.infra.storage import FileStore
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session

router = APIRouter(prefix="/upload", tags=["upload"])


class UploadResponse(BaseModel):
    video_id: str
    filename: str
    duration_sec: float


class LocalUploadRequest(BaseModel):
    path: str


def _register_uploaded_video(
    *,
    session: Session,
    ffmpeg: FFmpegService,
    video_id: str,
    path: Path,
    filename: str,
) -> UploadResponse:
    try:
        duration = ffmpeg.probe_duration(path)
    except FFmpegError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    normalized = ffmpeg.normalize_rotation(path)
    if normalized != path:
        path = normalized

    video = Video(
        id=video_id,
        filename=filename,
        source_path=str(path),
        duration_sec=duration,
    )
    VideoRepository(session).create(video)
    return UploadResponse(video_id=video_id, filename=filename, duration_sec=duration)


@router.post("", response_model=UploadResponse)
async def upload_video(
    file: UploadFile = File(...),
    session: Session = Depends(get_db_session),
    file_store: FileStore = Depends(get_file_store),
    ffmpeg: FFmpegService = Depends(get_ffmpeg_service),
) -> UploadResponse:
    data = await file.read()
    filename = file.filename or "video.mp4"
    video_id, path = file_store.save_upload(filename, data)
    return _register_uploaded_video(
        session=session,
        ffmpeg=ffmpeg,
        video_id=video_id,
        path=path,
        filename=filename,
    )


@router.post("/local", response_model=UploadResponse)
async def upload_video_local(
    body: LocalUploadRequest,
    session: Session = Depends(get_db_session),
    file_store: FileStore = Depends(get_file_store),
    ffmpeg: FFmpegService = Depends(get_ffmpeg_service),
) -> UploadResponse:
    source = Path(body.path).expanduser().resolve()
    if not source.is_file():
        raise HTTPException(status_code=400, detail="File not found")

    video_id, path = file_store.save_upload_from_path(source)
    return _register_uploaded_video(
        session=session,
        ffmpeg=ffmpeg,
        video_id=video_id,
        path=path,
        filename=source.name,
    )
