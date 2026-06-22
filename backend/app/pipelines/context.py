from dataclasses import dataclass, field
from pathlib import Path

from app.schemas.clip import ClipCandidate
from app.schemas.face import FaceFrame
from app.schemas.common import CaptionStyleName
from app.schemas.provider import ProviderConfig
from app.schemas.scene import Scene
from app.schemas.transcript import TranscriptSegment


@dataclass
class PipelineContext:
    video_id: str
    video_path: Path
    duration_sec: float
    language: str | None = None
    provider_config: ProviderConfig | None = None
    num_clips: int = 10
    caption_style: CaptionStyleName = CaptionStyleName.REELS
    words_per_screen: int | None = None
    audio_path: Path | None = None
    transcript: list[TranscriptSegment] = field(default_factory=list)
    scenes: list[Scene] = field(default_factory=list)
    clip_candidates: list[ClipCandidate] = field(default_factory=list)
    face_frames: list[FaceFrame] = field(default_factory=list)
    source_width: int = 1920
    source_height: int = 1080
