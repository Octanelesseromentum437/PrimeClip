from app.api.deps import (
    get_db_session,
    get_ffmpeg_service,
    get_file_store,
)
from app.db.models import Video
from app.db.repository import VideoRepository
from app.infra.ffmpeg import FFmpegService
from app.infra.storage import FileStore
from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlmodel import Session

router = APIRouter(prefix="/upload", tags=["upload"])


class UploadResponse(BaseModel):
    video_id: str
    filename: str
    duration_sec: float


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
    duration = ffmpeg.probe_duration(path)

    video = Video(
        id=video_id,
        filename=filename,
        source_path=str(path),
        duration_sec=duration,
    )
    VideoRepository(session).create(video)

    return UploadResponse(video_id=video_id, filename=filename, duration_sec=duration)
