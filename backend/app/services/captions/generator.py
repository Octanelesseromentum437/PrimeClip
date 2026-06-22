from pathlib import Path

from app.schemas.caption import (
    STYLE_PRESETS,
    CaptionEditState,
    CaptionFiles,
    CaptionStyle,
)
from app.schemas.common import AspectRatio, CaptionStyleName
from app.schemas.transcript import TranscriptSegment
from app.services.captions.ass_builder import AssBuilder
from app.services.captions.chunker import CaptionChunker
from app.services.captions.edit_store import CaptionEditStore


class CaptionService:
    def __init__(self) -> None:
        self.chunker = CaptionChunker()
        self.ass_builder = AssBuilder()
        self.edit_store = CaptionEditStore()

    def generate(
        self,
        segments: list[TranscriptSegment],
        clip_range: tuple[float, float],
        style_name: CaptionStyleName,
        output_dir: Path,
        *,
        style_override: CaptionStyle | None = None,
        aspect_ratio: AspectRatio = AspectRatio.VERTICAL,
    ) -> CaptionFiles:
        style = style_override or STYLE_PRESETS[style_name]
        cues = self.chunker.chunk_segments(segments, clip_range, style)
        return self.write_files(output_dir, style_name, style, cues, aspect_ratio=aspect_ratio)

    def write_files(
        self,
        output_dir: Path,
        style_name: CaptionStyleName,
        style: CaptionStyle,
        cues: list,
        *,
        aspect_ratio: AspectRatio = AspectRatio.VERTICAL,
    ) -> CaptionFiles:
        output_dir.mkdir(parents=True, exist_ok=True)
        srt_path = output_dir / "captions.srt"
        ass_path = output_dir / "captions.ass"
        play_res = (1920, 1080) if aspect_ratio == AspectRatio.HORIZONTAL else (1080, 1920)
        srt_path.write_text(self.ass_builder.build_srt(cues), encoding="utf-8")
        ass_path.write_text(
            self.ass_builder.build_ass(style, cues, play_res=play_res),
            encoding="utf-8",
        )
        self.edit_store.save(
            output_dir / "caption_edit.json",
            CaptionEditState(cues=cues, style=style),
        )
        return CaptionFiles(srt=srt_path, ass=ass_path, style=style_name)

    def load_or_build_edit(
        self,
        segments: list[TranscriptSegment],
        clip_range: tuple[float, float],
        style_name: CaptionStyleName,
        edit_path: Path,
    ) -> CaptionEditState:
        existing = self.edit_store.load(edit_path)
        if existing:
            return existing
        style = STYLE_PRESETS[style_name]
        cues = self.chunker.chunk_segments(segments, clip_range, style)
        state = CaptionEditState(cues=cues, style=style)
        self.edit_store.save(edit_path, state)
        return state
