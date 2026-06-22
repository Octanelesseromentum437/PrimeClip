from pathlib import Path

from app.schemas.common import CaptionStyleName
from app.schemas.timeline import TimelineState
from pydantic import BaseModel, Field


class CaptionStyle(BaseModel):
    font_family: str = "Impact"
    font_size: int = 80
    primary_color: str = "#FFFF00"
    outline_color: str = "#000000"
    outline_width: int = 4
    alignment: int = 2
    margin_v: int = 120
    words_per_screen: int = 3
    bold: bool = True


class CaptionCue(BaseModel):
    start: float
    end: float
    text: str


class CaptionEditState(BaseModel):
    cues: list[CaptionCue] = Field(default_factory=list)
    style: CaptionStyle = Field(default_factory=CaptionStyle)
    timeline: TimelineState = Field(default_factory=TimelineState)


class CaptionFiles(BaseModel):
    srt: Path
    ass: Path
    style: CaptionStyleName


STYLE_PRESETS: dict[CaptionStyleName, CaptionStyle] = {
    CaptionStyleName.CLASSIC: CaptionStyle(
        font_family="Arial",
        font_size=72,
        primary_color="#FFFFFF",
        outline_color="#000000",
        outline_width=4,
        margin_v=120,
        words_per_screen=5,
    ),
    CaptionStyleName.PODCAST: CaptionStyle(
        font_family="Helvetica",
        font_size=64,
        primary_color="#FFFFFF",
        outline_color="#000000",
        outline_width=3,
        margin_v=200,
        words_per_screen=6,
    ),
    CaptionStyleName.REELS: CaptionStyle(
        font_family="Impact",
        font_size=80,
        primary_color="#FFFF00",
        outline_color="#000000",
        outline_width=5,
        margin_v=100,
        words_per_screen=3,
    ),
    CaptionStyleName.MINIMAL: CaptionStyle(
        font_family="Arial",
        font_size=56,
        primary_color="#FFFFFF",
        outline_color="#000000",
        outline_width=2,
        bold=False,
        margin_v=140,
        words_per_screen=4,
    ),
}


class CaptionEditResponse(BaseModel):
    clip_id: str
    cues: list[CaptionCue]
    style: CaptionStyle
    preset: CaptionStyleName | None = None
    timeline: TimelineState = Field(default_factory=TimelineState)


class CaptionEditPatch(BaseModel):
    cues: list[CaptionCue] | None = None
    style: CaptionStyle | None = None
    preset: CaptionStyleName | None = None
    words_per_screen: int | None = Field(default=None, ge=1, le=10)
    timeline: TimelineState | None = None
