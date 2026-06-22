from pathlib import Path

from app.infra.ffmpeg import FFmpegService
from app.schemas.common import AspectRatio, Resolution, output_dimensions
from app.schemas.crop import CropPath
from app.schemas.timeline import TimelineState, VideoAudioTrim, VideoTrim


class TimelineRenderService:
    def __init__(self, ffmpeg: FFmpegService) -> None:
        self.ffmpeg = ffmpeg

    def _escape_filter_path(self, path: Path | str) -> str:
        escaped = str(path).replace("\\", "/")
        for char in ("\\", "'", ":", ",", "[", "]", ";"):
            escaped = escaped.replace(char, f"\\{char}")
        return escaped

    def _crop_filter(self, crop_path: CropPath, aspect_ratio: AspectRatio) -> str:
        if not crop_path.keyframes:
            if aspect_ratio == AspectRatio.HORIZONTAL:
                return "crop=ih*16/9:ih:(iw-ih*16/9)/2:0"
            return "crop=ih*9/16:ih:(iw-ih*9/16)/2:0"
        kf = crop_path.keyframes[0]
        sw, sh = crop_path.source_width, crop_path.source_height
        w = int(kf.width * sw) - (int(kf.width * sw) % 2)
        h = int(kf.height * sh) - (int(kf.height * sh) % 2)
        x = int(kf.x * sw) - (int(kf.x * sw) % 2)
        y = int(kf.y * sh) - (int(kf.y * sh) % 2)
        return f"crop={w}:{h}:{x}:{y}"

    def _effective_trim(self, trim: VideoTrim, clip_duration: float) -> tuple[float, float]:
        start = max(0.0, trim.start)
        end = trim.end if trim.end is not None else clip_duration
        end = min(clip_duration, max(start + 0.2, end))
        return start, end

    def _effective_audio_trim(
        self, trim: VideoTrim, audio_trim: VideoAudioTrim | None, clip_duration: float
    ) -> tuple[float, float, float, float]:
        trim_start, trim_end = self._effective_trim(trim, clip_duration)
        if audio_trim is None:
            return trim_start, trim_end, trim_start, 1.0
        start = max(0.0, audio_trim.start)
        end = audio_trim.end if audio_trim.end is not None else trim_end
        end = min(clip_duration, max(start + 0.2, end))
        return start, end, max(0.0, audio_trim.source_start), max(0.0, min(1.0, audio_trim.volume))

    def render_with_timeline(
        self,
        *,
        source_video: Path,
        clip_start: float,
        clip_end: float,
        crop_path: CropPath,
        aspect_ratio: AspectRatio,
        resolution: Resolution,
        timeline: TimelineState,
        assets_dir: Path,
        caption_ass: Path | None,
        output_path: Path,
        burn_captions: bool,
    ) -> float:
        clip_duration = clip_end - clip_start
        trim_start, trim_end = self._effective_trim(timeline.trim, clip_duration)
        audio_tl_start, audio_tl_end, audio_source_start, audio_volume = self._effective_audio_trim(
            timeline.trim, timeline.audio_trim, clip_duration
        )
        output_duration = trim_end - trim_start
        source_start = clip_start + trim_start

        out_w, out_h = output_dimensions(aspect_ratio, resolution)
        crop = self._crop_filter(crop_path, aspect_ratio)

        inputs: list[str] = [
            "-ss",
            str(source_start),
            "-i",
            str(source_video),
        ]

        overlay_items = sorted(
            timeline.overlays,
            key=lambda o: 0 if o.kind == "image" else 1,
        )
        audio_items = timeline.audio

        for item in overlay_items:
            asset_path = assets_dir / item.asset
            if asset_path.is_file():
                inputs.extend(["-i", str(asset_path)])

        for item in audio_items:
            asset_path = assets_dir / item.asset
            if asset_path.is_file():
                inputs.extend(["-i", str(asset_path)])

        filter_parts: list[str] = []
        base_v = f"[0:v]{crop},scale={out_w}:{out_h}"
        if burn_captions and caption_ass:
            ass_path = self._escape_filter_path(caption_ass)
            base_v += f",ass={ass_path}"
        base_v += "[vbase]"
        filter_parts.append(base_v)

        current_v = "vbase"
        overlay_input_idx = 1
        for item in overlay_items:
            asset_path = assets_dir / item.asset
            if not asset_path.is_file():
                continue
            overlay_dur = max(0.1, item.end - item.start)
            out_label = f"ov{item.id.replace('-', '')[:8]}"
            if item.kind == "broll":
                filter_parts.append(
                    f"[{overlay_input_idx}:v]"
                    f"trim=0:{overlay_dur},setpts=PTS-STARTPTS,"
                    f"scale={max(2, int(out_w * item.width / 100))}:"
                    f"{max(2, int(out_h * item.height / 100))},"
                    f"format=rgba,colorchannelmixer=aa={item.opacity}[{out_label}]"
                )
            else:
                filter_parts.append(
                    f"[{overlay_input_idx}:v]"
                    f"scale={max(2, int(out_w * item.width / 100))}:"
                    f"{max(2, int(out_h * item.height / 100))},"
                    f"format=rgba,colorchannelmixer=aa={item.opacity}[{out_label}]"
                )
            x_expr = f"main_w*{item.x}/100"
            y_expr = f"main_h*{item.y}/100"
            enable = f"between(t\\,{item.start}\\,{item.end})"
            next_v = f"v{out_label}"
            filter_parts.append(
                f"[{current_v}][{out_label}]overlay={x_expr}:{y_expr}:enable='{enable}'[{next_v}]"
            )
            current_v = next_v
            overlay_input_idx += 1

        final_v = current_v if current_v != "vbase" else "vbase"

        audio_input_idx = 1 + len([o for o in overlay_items if (assets_dir / o.asset).is_file()])
        audio_dur = audio_tl_end - audio_tl_start
        audio_source_end = audio_source_start + audio_dur
        audio_filters: list[str] = [
            "[0:a]atrim={src_start}:{src_end},asetpts=PTS-STARTPTS,volume={vol},"
            "adelay={delay_ms}|{delay_ms}[orig]".format(
                src_start=audio_source_start,
                src_end=audio_source_end,
                vol=audio_volume,
                delay_ms=int(audio_tl_start * 1000),
            )
        ]

        for i, item in enumerate(audio_items):
            asset_path = assets_dir / item.asset
            if not asset_path.is_file():
                continue
            label = f"aud{i}"
            item_dur = max(0.1, item.end - item.start)
            fades = ""
            if item.fade_in > 0:
                fades += f",afade=t=in:st=0:d={item.fade_in}"
            if item.fade_out > 0:
                fade_start = max(0, item_dur - item.fade_out)
                fades += f",afade=t=out:st={fade_start}:d={item.fade_out}"
            delay_ms = int(item.start * 1000)
            audio_filters.append(
                f"[{audio_input_idx}:a]atrim={item.source_offset}:{item.source_offset + item_dur},"
                f"asetpts=PTS-STARTPTS,volume={item.volume}{fades},"
                f"adelay={delay_ms}|{delay_ms}[{label}]"
            )
            audio_input_idx += 1

        audio_labels = ["[orig]"] + [
            f"[aud{i}]" for i, item in enumerate(audio_items) if (assets_dir / item.asset).is_file()
        ]
        if len(audio_labels) > 1:
            audio_filters.append(
                f"{''.join(audio_labels)}amix=inputs={len(audio_labels)}:duration=first:dropout_transition=0[aout]"
            )
            final_a = "aout"
        else:
            final_a = "orig"

        filter_complex = ";".join(filter_parts + audio_filters)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            *inputs,
            "-filter_complex",
            filter_complex,
            "-map",
            f"[{final_v}]",
            "-map",
            f"[{final_a}]",
            "-t",
            str(output_duration),
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
        self.ffmpeg.run(cmd)
        return output_duration
