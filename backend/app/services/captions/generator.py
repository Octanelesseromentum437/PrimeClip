from pathlib import Path

from app.schemas.caption import CaptionFiles
from app.schemas.common import CaptionStyleName
from app.schemas.transcript import TranscriptSegment

ASS_TEMPLATES: dict[CaptionStyleName, str] = {
    CaptionStyleName.CLASSIC: """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,0,2,40,40,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""",
    CaptionStyleName.PODCAST: """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Helvetica,64,&H00FFFFFF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,3,0,2,40,40,200,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""",
    CaptionStyleName.REELS: """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Impact,80,&H0000FFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,5,2,2,40,40,100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""",
    CaptionStyleName.MINIMAL: """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,56,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,40,40,140,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""",
}


def _format_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _format_ass_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}:{m:02d}:{s:05.2f}"


class CaptionService:
    def generate(
        self,
        segments: list[TranscriptSegment],
        clip_range: tuple[float, float],
        style: CaptionStyleName,
        output_dir: Path,
    ) -> CaptionFiles:
        start, end = clip_range
        output_dir.mkdir(parents=True, exist_ok=True)
        clip_segments = [
            TranscriptSegment(
                start=max(0.0, seg.start - start),
                end=min(end - start, seg.end - start),
                text=seg.text,
                confidence=seg.confidence,
            )
            for seg in segments
            if seg.end > start and seg.start < end
        ]

        srt_lines: list[str] = []
        ass_events: list[str] = []
        for i, seg in enumerate(clip_segments, 1):
            if seg.end <= seg.start:
                continue
            text = seg.text.replace("\n", " ").strip()
            srt_lines.append(str(i))
            srt_lines.append(f"{_format_srt_time(seg.start)} --> {_format_srt_time(seg.end)}")
            srt_lines.append(text)
            srt_lines.append("")
            ass_events.append(
                f"Dialogue: 0,{_format_ass_time(seg.start)},{_format_ass_time(seg.end)},Default,,0,0,0,,{text}"
            )

        srt_path = output_dir / "captions.srt"
        ass_path = output_dir / "captions.ass"
        srt_path.write_text("\n".join(srt_lines), encoding="utf-8")
        ass_content = ASS_TEMPLATES[style] + "\n".join(ass_events) + "\n"
        ass_path.write_text(ass_content, encoding="utf-8")

        return CaptionFiles(srt=srt_path, ass=ass_path, style=style)
