from pathlib import Path
import shutil
import uuid

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
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session

router = APIRouter(prefix="/clips", tags=["captions"])


class RerenderResponse(BaseModel):
    clip_id: str
    output_path: str
    status: str


class MediaUploadResponse(BaseModel):
    asset: str
    label: str
    url: str


class LocalMediaRequest(BaseModel):
    path: str


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
        timeline=state.timeline,
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
    if body.timeline is not None:
        state.timeline = body.timeline

    rerender_svc.save_edit_state(clip, state)
    preset = _detect_preset(state.style)
    return CaptionEditResponse(
        clip_id=clip.id,
        cues=state.cues,
        style=state.style,
        preset=preset,
        timeline=state.timeline,
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


def _save_editor_asset(
    clip,
    rerender_svc: ClipRerenderService,
    source: Path,
    original_name: str,
) -> MediaUploadResponse:
    assets_dir = rerender_svc.assets_dir(clip)
    assets_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(original_name).name.replace(" ", "_")
    asset_name = f"{uuid.uuid4().hex[:10]}_{safe_name}"
    dest = assets_dir / asset_name
    shutil.copy2(source, dest)
    return MediaUploadResponse(
        asset=asset_name,
        label=Path(original_name).stem,
        url=f"/api/clips/{clip.id}/media/{asset_name}",
    )


@router.post("/{clip_id}/media", response_model=MediaUploadResponse)
async def upload_editor_media(
    clip_id: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_db_session),
    rerender_svc: ClipRerenderService = Depends(get_clip_rerender_service),
) -> MediaUploadResponse:
    clip = ClipRepository(session).get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    filename = file.filename or "asset.bin"
    tmp = rerender_svc.assets_dir(clip) / f"_tmp_{uuid.uuid4().hex}"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    data = await file.read()
    tmp.write_bytes(data)
    try:
        return _save_editor_asset(clip, rerender_svc, tmp, filename)
    finally:
        tmp.unlink(missing_ok=True)


@router.post("/{clip_id}/media/local", response_model=MediaUploadResponse)
def upload_editor_media_local(
    clip_id: str,
    body: LocalMediaRequest,
    session: Session = Depends(get_db_session),
    rerender_svc: ClipRerenderService = Depends(get_clip_rerender_service),
) -> MediaUploadResponse:
    clip = ClipRepository(session).get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    source = Path(body.path).expanduser().resolve()
    if not source.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return _save_editor_asset(clip, rerender_svc, source, source.name)


@router.get("/{clip_id}/media/{asset}")
def serve_editor_media(
    clip_id: str,
    asset: str,
    session: Session = Depends(get_db_session),
    rerender_svc: ClipRerenderService = Depends(get_clip_rerender_service),
):
    clip = ClipRepository(session).get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    if ".." in asset or "/" in asset or "\\" in asset:
        raise HTTPException(status_code=400, detail="Invalid asset name")
    path = rerender_svc.assets_dir(clip) / asset
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Asset not found")
    return FileResponse(path)


def _detect_preset(style) -> CaptionStyleName | None:
    for name, preset in STYLE_PRESETS.items():
        if style.model_dump() == preset.model_dump():
            return name
    return None
