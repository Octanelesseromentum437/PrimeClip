from pathlib import Path

from app.api.deps import get_db_session, get_file_store
from app.config import get_settings
from app.db.repository import ClipRepository, JobRepository, VideoRepository
from app.infra.paths import resolve_storage_path
from app.infra.storage import FileStore
from app.schemas.video import VideoDetail, VideoSummary, VideosListResponse
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session

router = APIRouter(prefix="/videos", tags=["videos"])


def _build_summary(session: Session, video) -> VideoSummary:
    latest_job = JobRepository(session).get_latest_for_video(video.id)
    clip_count = ClipRepository(session).count_for_video(video.id)
    return VideoSummary(
        id=video.id,
        filename=video.filename,
        duration_sec=video.duration_sec,
        created_at=video.created_at,
        latest_job_status=latest_job.status if latest_job else None,
        latest_job_id=latest_job.id if latest_job else None,
        clip_count=clip_count,
        source_resolution=(
            f"{video.source_width}x{video.source_height}"
            if video.source_width and video.source_height
            else None
        ),
    )


@router.get("", response_model=VideosListResponse)
def list_videos(session: Session = Depends(get_db_session)) -> VideosListResponse:
    videos = VideoRepository(session).list_all()
    return VideosListResponse(videos=[_build_summary(session, v) for v in videos])


@router.get("/{video_id}", response_model=VideoDetail)
def get_video(video_id: str, session: Session = Depends(get_db_session)) -> VideoDetail:
    video = VideoRepository(session).get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    summary = _build_summary(session, video)
    job_count = len(JobRepository(session).list_for_video(video_id))
    return VideoDetail(
        **summary.model_dump(),
        source_path=str(resolve_storage_path(video.source_path, get_settings())),
        language=video.language,
        job_count=job_count,
    )


@router.get("/{video_id}/source")
def stream_source_video(
    video_id: str,
    session: Session = Depends(get_db_session),
) -> FileResponse:
    video = VideoRepository(session).get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    path = Path(video.source_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Source file missing")
    return FileResponse(path, media_type="video/mp4", filename=video.filename)


@router.delete("/{video_id}", status_code=204)
def delete_video(
    video_id: str,
    session: Session = Depends(get_db_session),
    file_store: FileStore = Depends(get_file_store),
) -> None:
    video = VideoRepository(session).get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    ClipRepository(session).delete_for_video(video_id)
    JobRepository(session).delete_for_video(video_id)
    VideoRepository(session).delete(video_id)
    file_store.delete_video_data(video_id)
