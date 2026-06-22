from typing import Self

from pydantic import BaseModel, Field, model_validator


class ClipCandidate(BaseModel):
    title: str
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    score: float = Field(ge=0, le=10)
    reason: str

    @model_validator(mode="after")
    def validate_duration(self) -> Self:
        duration = self.end - self.start
        if duration < 30 or duration > 90:
            raise ValueError(f"clip duration {duration:.1f}s out of range (30-90)")
        if self.end <= self.start:
            raise ValueError("end must be greater than start")
        return self


class ClipSelectionRequest(BaseModel):
    transcript: list
    scenes: list
    duration_sec: float
    language: str = "en"
    num_clips: int = Field(default=10, ge=1, le=20)
    min_clip_sec: float = 30
    max_clip_sec: float = 90


class ClipRecordResponse(BaseModel):
    id: str
    index: int
    title: str
    start_sec: float
    end_sec: float
    score: float
    reason: str
    status: str
    output_path: str | None = None
    thumbnail_path: str | None = None
