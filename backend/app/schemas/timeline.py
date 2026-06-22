from typing import Literal

from pydantic import BaseModel, Field


class VideoTrim(BaseModel):
    start: float = 0.0
    end: float | None = None


class VideoAudioTrim(BaseModel):
    start: float = 0.0
    end: float | None = None
    source_start: float = 0.0
    volume: float = 1.0


class OverlayItem(BaseModel):
    id: str
    kind: Literal["image", "broll"] = "image"
    start: float
    end: float
    asset: str
    label: str = ""
    x: float = 0.0
    y: float = 0.0
    width: float = 100.0
    height: float = 100.0
    opacity: float = 1.0
    volume: float = 1.0


class AudioItem(BaseModel):
    id: str
    start: float
    end: float
    asset: str
    label: str = ""
    volume: float = 0.35
    source_offset: float = 0.0
    fade_in: float = 0.5
    fade_out: float = 0.5


class TimelineState(BaseModel):
    trim: VideoTrim = Field(default_factory=VideoTrim)
    audio_trim: VideoAudioTrim | None = None
    overlays: list[OverlayItem] = Field(default_factory=list)
    audio: list[AudioItem] = Field(default_factory=list)
