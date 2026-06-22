from pathlib import Path

from app.api.deps import get_db_session, get_ffmpeg_service, get_file_store
from app.api.deps_captions import get_clip_rerender_service
from app.db.models import ClipVariant
from app.db.repository import ClipRepository, ClipVariantRepository, VideoRepository
from app.infra.ffmpeg import FFmpegService
from app.infra.storage import FileStore
from app.schemas.clip import ClipRecordResponse
from app.schemas.common import (
    AspectRatio,
    Resolution,
    available_resolution_labels,
    parse_resolution_label,
    resolution_label,
)
from app.services.captions.rerender import ClipRerenderService
from app.services.media_cache import ensure_clip_filmstrip, ensure_clip_waveform
from app.services.thumbnails import ensure_clip_thumbnail
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
                thumbnail_path=c.thumbnail_path,
            )
            for c in clips
        ]
    )


download_router = APIRouter(prefix="/download", tags=["clips"])


class QualitiesResponse(BaseModel):
    resolutions: list[str]
    aspect_ratio: str


def _resolve_resolution(
    label: str | None,
    aspect_ratio: AspectRatio,
    source_width: int | None,
    source_height: int | None,
) -> Resolution:
    if label:
        if label in {res.value for res in Resolution}:
            return Resolution(label)
        return parse_resolution_label(label, aspect_ratio)

    if source_width and source_height:
        allowed = available_resolution_labels(source_width, source_height, aspect_ratio)
        if allowed:
            return parse_resolution_label(allowed[0], aspect_ratio)
    return Resolution.HD


@download_router.get("/{clip_id}/qualities", response_model=QualitiesResponse)
def list_qualities(
    clip_id: str,
    session: Session = Depends(get_db_session),
    rerender_svc: ClipRerenderService = Depends(get_clip_rerender_service),
) -> QualitiesResponse:
    clip = ClipRepository(session).get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    video = VideoRepository(session).get(clip.video_id)
    aspect_ratio = rerender_svc.load_aspect_ratio(clip.video_id)
    if not video or not video.source_width or not video.source_height:
        return QualitiesResponse(
            resolutions=[
                resolution_label(aspect_ratio, Resolution.HD),
                resolution_label(aspect_ratio, Resolution.SD),
            ],
            aspect_ratio=aspect_ratio.value,
        )
    resolutions = available_resolution_labels(
        video.source_width, video.source_height, aspect_ratio
    )
    return QualitiesResponse(resolutions=resolutions, aspect_ratio=aspect_ratio.value)


def _editor_preview_resolution(
    aspect_ratio: AspectRatio,
    source_width: int | None,
    source_height: int | None,
) -> Resolution:
    if source_width and source_height:
        allowed = available_resolution_labels(source_width, source_height, aspect_ratio)
        if allowed:
            return parse_resolution_label(allowed[-1], aspect_ratio)
    return Resolution.SD


@download_router.get("/{clip_id}/preview")
def preview_clip(
    clip_id: str,
    resolution: str | None = Query(default=None),
    session: Session = Depends(get_db_session),
    rerender_svc: ClipRerenderService = Depends(get_clip_rerender_service),
) -> FileResponse:
    clip = ClipRepository(session).get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    video = VideoRepository(session).get(clip.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    aspect_ratio = rerender_svc.load_aspect_ratio(clip.video_id)
    if resolution:
        target = _resolve_resolution(
            resolution,
            aspect_ratio,
            video.source_width,
            video.source_height,
        )
    else:
        target = _editor_preview_resolution(
            aspect_ratio,
            video.source_width,
            video.source_height,
        )

    preview_path = rerender_svc.preview_path(clip, target)
    if not preview_path.is_file():
        preview_path = rerender_svc.ensure_preview(
            clip,
            Path(video.source_path),
            resolution=target,
        )

    return FileResponse(
        preview_path,
        media_type="video/mp4",
        content_disposition_type="inline",
        filename=preview_path.name,
    )


@download_router.get("/{clip_id}/filmstrip")
def clip_filmstrip(
    clip_id: str,
    start: float = Query(default=0.0, ge=0.0),
    end: float = Query(..., gt=0.0),
    frames: int = Query(default=8, ge=1, le=60),
    height: int = Query(default=48, ge=16, le=256),
    session: Session = Depends(get_db_session),
    file_store: FileStore = Depends(get_file_store),
    ffmpeg: FFmpegService = Depends(get_ffmpeg_service),
    rerender_svc: ClipRerenderService = Depends(get_clip_rerender_service),
) -> FileResponse:
    clip = ClipRepository(session).get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    video = VideoRepository(session).get(clip.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    aspect_ratio = rerender_svc.load_aspect_ratio(clip.video_id)
    resolution = _editor_preview_resolution(
        aspect_ratio,
        video.source_width,
        video.source_height,
    )

    filmstrip_path = ensure_clip_filmstrip(
        clip,
        Path(video.source_path),
        file_store,
        ffmpeg,
        rerender_svc,
        start_sec=start,
        end_sec=end,
        frame_count=frames,
        height=height,
        resolution=resolution,
    )

    return FileResponse(
        filmstrip_path,
        media_type="image/jpeg",
        content_disposition_type="inline",
        filename=filmstrip_path.name,
    )


class WaveformResponse(BaseModel):
    peaks: list[float]
    duration: float


@download_router.get("/{clip_id}/waveform", response_model=WaveformResponse)
def clip_waveform(
    clip_id: str,
    session: Session = Depends(get_db_session),
    file_store: FileStore = Depends(get_file_store),
    ffmpeg: FFmpegService = Depends(get_ffmpeg_service),
    rerender_svc: ClipRerenderService = Depends(get_clip_rerender_service),
) -> WaveformResponse:
    clip = ClipRepository(session).get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    video = VideoRepository(session).get(clip.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    aspect_ratio = rerender_svc.load_aspect_ratio(clip.video_id)
    resolution = _editor_preview_resolution(
        aspect_ratio,
        video.source_width,
        video.source_height,
    )

    payload = ensure_clip_waveform(
        clip,
        Path(video.source_path),
        file_store,
        ffmpeg,
        rerender_svc,
        resolution=resolution,
    )
    return WaveformResponse.model_validate(payload)


@download_router.get("/{clip_id}/thumbnail")
def clip_thumbnail(
    clip_id: str,
    session: Session = Depends(get_db_session),
    file_store: FileStore = Depends(get_file_store),
    ffmpeg: FFmpegService = Depends(get_ffmpeg_service),
) -> FileResponse:
    clip = ClipRepository(session).get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    thumb_path = ensure_clip_thumbnail(clip, file_store, ffmpeg)
    if thumb_path is None:
        raise HTTPException(status_code=404, detail="Thumbnail not available")

    if clip.thumbnail_path != str(thumb_path):
        clip.thumbnail_path = str(thumb_path)
        ClipRepository(session).update(clip)

    return FileResponse(
        thumb_path,
        media_type="image/jpeg",
        content_disposition_type="inline",
        filename=thumb_path.name,
    )


@download_router.get("/{clip_id}")
def download_clip(
    clip_id: str,
    resolution: str | None = Query(default=None),
    session: Session = Depends(get_db_session),
    rerender_svc: ClipRerenderService = Depends(get_clip_rerender_service),
) -> FileResponse:
    clip = ClipRepository(session).get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    video = VideoRepository(session).get(clip.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    aspect_ratio = rerender_svc.load_aspect_ratio(clip.video_id)
    target = _resolve_resolution(
        resolution,
        aspect_ratio,
        video.source_width,
        video.source_height,
    )
    target_label = resolution_label(aspect_ratio, target)
    variant_repo = ClipVariantRepository(session)

    if target == Resolution.HD and clip.output_path and resolution is None:
        path = Path(clip.output_path)
        if path.is_file():
            return FileResponse(path, media_type="video/mp4", filename=path.name)

    variant = variant_repo.get(clip_id, target_label)
    if not variant:
        # Backward compatibility with legacy resolution keys.
        legacy = variant_repo.get(clip_id, target.value)
        variant = legacy
    if variant and Path(variant.output_path).is_file():
        path = Path(variant.output_path)
        return FileResponse(path, media_type="video/mp4", filename=path.name)

    if video.source_width and video.source_height:
        allowed = {
            resolution_label(aspect_ratio, res)
            for res in available_resolution_labels(
                video.source_width, video.source_height, aspect_ratio
            )
        }
        if target_label not in allowed:
            raise HTTPException(status_code=400, detail="Resolution exceeds source quality")

    output_path = rerender_svc.rerender(
        clip,
        Path(video.source_path),
        resolution=target,
    )
    variant_repo.upsert(
        ClipVariant(
            clip_id=clip.id,
            resolution=target_label,
            output_path=str(output_path),
        )
    )
    if target == Resolution.HD:
        clip.output_path = str(output_path)
    ClipRepository(session).update(clip)

    return FileResponse(output_path, media_type="video/mp4", filename=output_path.name)
