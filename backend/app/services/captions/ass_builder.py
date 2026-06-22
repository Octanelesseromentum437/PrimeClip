from app.schemas.caption import CaptionCue, CaptionStyle


def _hex_to_ass_color(hex_color: str) -> str:
    color = hex_color.lstrip("#")
    if len(color) != 6:
        return "&H00FFFFFF"
    r, g, b = color[0:2], color[2:4], color[4:6]
    return f"&H00{b}{g}{r}"


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


class AssBuilder:
    def build_header(self, style: CaptionStyle, *, play_res: tuple[int, int] = (1080, 1920)) -> str:
        play_res_x, play_res_y = play_res
        primary = _hex_to_ass_color(style.primary_color)
        outline = _hex_to_ass_color(style.outline_color)
        bold = -1 if style.bold else 0
        return f"""[Script Info]
ScriptType: v4.00+
PlayResX: {play_res_x}
PlayResY: {play_res_y}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{style.font_family},{style.font_size},{primary},&H000000FF,{outline},&H00000000,{bold},0,0,0,100,100,0,0,1,{style.outline_width},2,{style.alignment},40,40,{style.margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    def build_ass(
        self,
        style: CaptionStyle,
        cues: list[CaptionCue],
        *,
        play_res: tuple[int, int] = (1080, 1920),
    ) -> str:
        events: list[str] = []
        for cue in cues:
            if cue.end <= cue.start or not cue.text.strip():
                continue
            text = cue.text.replace("\n", " ").strip()
            events.append(
                f"Dialogue: 0,{_format_ass_time(cue.start)},{_format_ass_time(cue.end)},Default,,0,0,0,,{text}"
            )
        return self.build_header(style, play_res=play_res) + "\n".join(events) + "\n"

    def build_srt(self, cues: list[CaptionCue]) -> str:
        lines: list[str] = []
        for i, cue in enumerate(cues, 1):
            if cue.end <= cue.start or not cue.text.strip():
                continue
            lines.append(str(i))
            lines.append(f"{_format_srt_time(cue.start)} --> {_format_srt_time(cue.end)}")
            lines.append(cue.text.strip())
            lines.append("")
        return "\n".join(lines)
