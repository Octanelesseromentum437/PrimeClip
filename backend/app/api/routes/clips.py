from app.api.deps import get_db_session
from app.db.repository import ClipRepository
from app.schemas.clip import ClipRecordResponse
from fastapi import APIRouter, Depends, HTTPException
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


@download_router.get("/{clip_id}")
def download_clip(clip_id: str, session: Session = Depends(get_db_session)) -> FileResponse:
    clip = ClipRepository(session).get(clip_id)
    if not clip or not clip.output_path:
        raise HTTPException(status_code=404, detail="Clip not found")
    from pathlib import Path

    path = Path(clip.output_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Clip file missing")
    return FileResponse(path, media_type="video/mp4", filename=path.name)
