from pathlib import Path

from app.schemas.common import CaptionStyleName
from pydantic import BaseModel


class CaptionFiles(BaseModel):
    srt: Path
    ass: Path
    style: CaptionStyleName
