from datetime import datetime

from pydantic import BaseModel


class VideoSummary(BaseModel):
    id: str
    filename: str
    duration_sec: float
    created_at: datetime
    latest_job_status: str | None = None
    latest_job_id: str | None = None
    clip_count: int = 0
    source_resolution: str | None = None


class VideoDetail(VideoSummary):
    source_path: str
    language: str | None = None
    job_count: int = 0


class VideosListResponse(BaseModel):
    videos: list[VideoSummary]
