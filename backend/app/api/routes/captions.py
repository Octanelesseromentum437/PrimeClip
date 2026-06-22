from pathlib import Path

from app.api.deps import get_db_session
from app.api.deps_captions import get_clip_rerender_service
from app.db.repository import ClipRepository, VideoRepository
from app.schemas.caption import (
    CaptionEditPatch,
    CaptionEditResponse,
    STYLE_PRESETS,
)
from app.schemas.common import CaptionStyleName, ClipStatus
from app.services.captions.rerender import ClipRerenderService
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

router = APIRouter(prefix="/clips", tags=["captions"])


class RerenderResponse(BaseModel):
    clip_id: str
    output_path: str
    status: str


@router.get("/{clip_id}/captions", response_model=CaptionEditResponse)
def get_captions(
    clip_id: str,
    session: Session = Depends(get_db_session),
    rerender_svc: ClipRerenderService = Depends(get_clip_rerender_service),
) -> CaptionEditResponse:
    clip = ClipRepository(session).get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    state = rerender_svc.get_edit_state(clip)
    preset = _detect_preset(state.style)
    return CaptionEditResponse(
        clip_id=clip.id,
        cues=state.cues,
        style=state.style,
        preset=preset,
    )


@router.patch("/{clip_id}/captions", response_model=CaptionEditResponse)
def patch_captions(
    clip_id: str,
    body: CaptionEditPatch,
    session: Session = Depends(get_db_session),
    rerender_svc: ClipRerenderService = Depends(get_clip_rerender_service),
) -> CaptionEditResponse:
    clip = ClipRepository(session).get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    state = rerender_svc.get_edit_state(clip)
    if body.preset:
        state.style = STYLE_PRESETS[body.preset].model_copy()
    if body.style:
        state.style = body.style
    if body.words_per_screen is not None:
        state.style = state.style.model_copy(update={"words_per_screen": body.words_per_screen})
        state.cues = rerender_svc.rechunk_cues(clip, state.style)
    if body.cues is not None:
        state.cues = body.cues

    rerender_svc.save_edit_state(clip, state)
    preset = _detect_preset(state.style)
    return CaptionEditResponse(
        clip_id=clip.id,
        cues=state.cues,
        style=state.style,
        preset=preset,
    )


@router.post("/{clip_id}/re-render", response_model=RerenderResponse)
def rerender_clip(
    clip_id: str,
    session: Session = Depends(get_db_session),
    rerender_svc: ClipRerenderService = Depends(get_clip_rerender_service),
) -> RerenderResponse:
    clip = ClipRepository(session).get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    video = VideoRepository(session).get(clip.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    clip.status = ClipStatus.RENDERING.value
    ClipRepository(session).update(clip)

    try:
        output_path = rerender_svc.rerender(clip, Path(video.source_path))
        clip.output_path = str(output_path)
        clip.status = ClipStatus.READY.value
        ClipRepository(session).update(clip)
    except Exception as exc:
        clip.status = ClipStatus.FAILED.value
        ClipRepository(session).update(clip)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return RerenderResponse(
        clip_id=clip.id,
        output_path=str(output_path),
        status=clip.status,
    )


def _detect_preset(style) -> CaptionStyleName | None:
    for name, preset in STYLE_PRESETS.items():
        if style.model_dump() == preset.model_dump():
            return name
    return None
