from pathlib import Path

from app.api.deps import get_db_session
from app.api.deps_captions import get_clip_rerender_service
from app.db.models import ClipVariant
from app.db.repository import ClipRepository, ClipVariantRepository, VideoRepository
from app.schemas.clip import ClipRecordResponse
from app.schemas.common import Resolution, available_resolutions
from app.services.captions.rerender import ClipRerenderService
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session

router = APIRouter(prefix="/clips", tags=["clips"])


class ClipsListResponse(BaseModel):
    clips: list[ClipRecordResponse]


@router.get("/{video_id}", response_model=ClipsListResponse)
def list_clips(video_id: str, session: Session = Depends(get_db_session)) -> ClipsListResponse:
    clips = ClipRepository(session).list_for_video(video_id)
    return ClipsListResponse(
        clips=[
            ClipRecordResponse(
                id=c.id,
                index=c.index,
                title=c.title,
                start_sec=c.start_sec,
                end_sec=c.end_sec,
                score=c.score,
                reason=c.reason,
                status=c.status,
                output_path=c.output_path,
            )
            for c in clips
        ]
    )


download_router = APIRouter(prefix="/download", tags=["clips"])


class QualitiesResponse(BaseModel):
    resolutions: list[str]


@download_router.get("/{clip_id}/qualities", response_model=QualitiesResponse)
def list_qualities(
    clip_id: str,
    session: Session = Depends(get_db_session),
) -> QualitiesResponse:
    clip = ClipRepository(session).get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    video = VideoRepository(session).get(clip.video_id)
    if not video or not video.source_width or not video.source_height:
        return QualitiesResponse(resolutions=[Resolution.HD.value, Resolution.SD.value])
    resolutions = [r.value for r in available_resolutions(video.source_width, video.source_height)]
    return QualitiesResponse(resolutions=resolutions)


@download_router.get("/{clip_id}")
def download_clip(
    clip_id: str,
    resolution: Resolution | None = Query(default=None),
    session: Session = Depends(get_db_session),
    rerender_svc: ClipRerenderService = Depends(get_clip_rerender_service),
) -> FileResponse:
    clip = ClipRepository(session).get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    target = resolution or Resolution.HD
    variant_repo = ClipVariantRepository(session)

    if target == Resolution.HD and clip.output_path and resolution is None:
        path = Path(clip.output_path)
        if path.is_file():
            return FileResponse(path, media_type="video/mp4", filename=path.name)

    variant = variant_repo.get(clip_id, target.value)
    if variant and Path(variant.output_path).is_file():
        path = Path(variant.output_path)
        return FileResponse(path, media_type="video/mp4", filename=path.name)

    video = VideoRepository(session).get(clip.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.source_width and video.source_height:
        allowed = {r.value for r in available_resolutions(video.source_width, video.source_height)}
        if target.value not in allowed:
            raise HTTPException(status_code=400, detail="Resolution exceeds source quality")

    output_path = rerender_svc.rerender(clip, Path(video.source_path), resolution=target)
    variant_repo.upsert(
        ClipVariant(
            clip_id=clip.id,
            resolution=target.value,
            output_path=str(output_path),
        )
    )
    if target == Resolution.HD:
        clip.output_path = str(output_path)
        ClipRepository(session).update(clip)

    return FileResponse(output_path, media_type="video/mp4", filename=output_path.name)
