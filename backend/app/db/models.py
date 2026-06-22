from datetime import UTC, datetime
from uuid import uuid4

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(UTC)


class Video(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    filename: str
    source_path: str
    duration_sec: float = 0.0
    language: str | None = None
    source_width: int | None = None
    source_height: int | None = None
    source_url: str | None = None
    source_provider: str | None = None
    created_at: datetime = Field(default_factory=utcnow)


class Job(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    video_id: str = Field(foreign_key="video.id", index=True)
    provider_kind: str
    model: str
    num_clips: int = 10
    status: str = "queued"
    progress_pct: int = 0
    current_stage: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class Clip(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    job_id: str = Field(foreign_key="job.id", index=True)
    video_id: str = Field(foreign_key="video.id", index=True)
    index: int
    title: str
    start_sec: float
    end_sec: float
    score: float
    reason: str
    output_path: str | None = None
    status: str = "pending"


class ClipVariant(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    clip_id: str = Field(foreign_key="clip.id", index=True)
    resolution: str
    output_path: str
    created_at: datetime = Field(default_factory=utcnow)


class AppPreferences(SQLModel, table=True):
    id: int | None = Field(default=1, primary_key=True)
    default_provider_kind: str = "ollama"
    default_model: str = "qwen3"
    ollama_base_url: str = "http://localhost:11434"
    whisper_model: str = "base"
    output_dir: str | None = None
