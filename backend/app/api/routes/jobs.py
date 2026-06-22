from app.api.deps import get_db_session, get_job_runner
from app.db.models import Job
from app.db.repository import JobRepository, VideoRepository
from app.jobs.runner import JobRunner
from app.schemas.common import CaptionStyleName, JobStatus, AspectRatio
from app.schemas.provider import ProviderConfig
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

router = APIRouter(prefix="/generate-clips", tags=["jobs"])


class GenerateClipsRequest(BaseModel):
    video_id: str
    provider: ProviderConfig
    num_clips: int = Field(default=10, ge=1, le=20)
    language: str | None = None
    caption_style: CaptionStyleName = CaptionStyleName.REELS
    words_per_screen: int | None = Field(default=None, ge=1, le=10)
    aspect_ratio: AspectRatio = AspectRatio.VERTICAL


class GenerateClipsResponse(BaseModel):
    job_id: str


class JobStatusResponse(BaseModel):
    id: str
    video_id: str
    status: str
    progress_pct: int
    current_stage: str | None
    error_message: str | None


@router.post("", response_model=GenerateClipsResponse)
async def generate_clips(
    body: GenerateClipsRequest,
    session: Session = Depends(get_db_session),
    runner: JobRunner = Depends(get_job_runner),
) -> GenerateClipsResponse:
    video = VideoRepository(session).get(body.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    job = Job(
        video_id=body.video_id,
        provider_kind=body.provider.kind.value,
        model=body.provider.model,
        num_clips=body.num_clips,
        status=JobStatus.QUEUED.value,
    )
    job = JobRepository(session).create(job)

    runner.enqueue(
        job_id=job.id,
        video_id=body.video_id,
        provider_config=body.provider,
        num_clips=body.num_clips,
        language=body.language,
        caption_style=body.caption_style,
        words_per_screen=body.words_per_screen,
        aspect_ratio=body.aspect_ratio,
    )

    return GenerateClipsResponse(job_id=job.id)


jobs_router = APIRouter(prefix="/jobs", tags=["jobs"])


@jobs_router.get("/{job_id}", response_model=JobStatusResponse)
def get_job(job_id: str, session: Session = Depends(get_db_session)) -> JobStatusResponse:
    job = JobRepository(session).get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(
        id=job.id,
        video_id=job.video_id,
        status=job.status,
        progress_pct=job.progress_pct,
        current_stage=job.current_stage,
        error_message=job.error_message,
    )


@jobs_router.post("/{job_id}/cancel", response_model=JobStatusResponse)
def cancel_job(
    job_id: str,
    session: Session = Depends(get_db_session),
    runner: JobRunner = Depends(get_job_runner),
) -> JobStatusResponse:
    job = JobRepository(session).get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in (JobStatus.QUEUED.value, JobStatus.RUNNING.value):
        raise HTTPException(status_code=409, detail="Job cannot be cancelled")

    runner.cancel(job_id, session)
    session.refresh(job)
    return JobStatusResponse(
        id=job.id,
        video_id=job.video_id,
        status=job.status,
        progress_pct=job.progress_pct,
        current_stage=job.current_stage,
        error_message=job.error_message,
    )
