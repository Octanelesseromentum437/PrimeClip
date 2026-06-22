from pathlib import Path

from app.schemas.clip import ClipCandidate
from app.schemas.common import AspectRatio, Resolution
from app.schemas.crop import CropPath
from app.schemas.motion import MotionPlan
from pydantic import BaseModel


class RenderRequest(BaseModel):
    source_video: Path
    clip: ClipCandidate
    crop_path: CropPath
    caption_ass: Path | None = None
    motion_plan: MotionPlan
    output_path: Path
    resolution: Resolution = Resolution.HD
    aspect_ratio: AspectRatio = AspectRatio.VERTICAL
    burn_captions: bool = True


class RenderResult(BaseModel):
    output_path: Path
    duration_sec: float
