
from pathlib import Path

from app.infra.ffmpeg import FFmpegService
from app.schemas.common import Resolution
from app.schemas.crop import CropPath
from app.schemas.render import RenderRequest, RenderResult


class RenderService:
    RESOLUTIONS = {
        Resolution.UHD: (2160, 3840),
        Resolution.HD: (1080, 1920),
        Resolution.SD: (720, 1280),
    }

    def __init__(self, ffmpeg: FFmpegService) -> None:
        self.ffmpeg = ffmpeg

    def _escape_filter_path(self, path: Path | str) -> str:
        escaped = str(path).replace("\\", "/")
        for char in ("\\", "'", ":", ",", "[", "]", ";"):
            escaped = escaped.replace(char, f"\\{char}")
        return escaped

    def _crop_filter(self, crop_path: CropPath) -> str:
        if not crop_path.keyframes:
            return "crop=ih*9/16:ih:(iw-ih*9/16)/2:0"
        kf = crop_path.keyframes[0]
        sw, sh = crop_path.source_width, crop_path.source_height
        w = int(kf.width * sw)
        h = int(kf.height * sh)
        x = int(kf.x * sw)
        y = int(kf.y * sh)
        w = w - (w % 2)
        h = h - (h % 2)
        x = x - (x % 2)
        y = y - (y % 2)
        return f"crop={w}:{h}:{x}:{y}"

    def render(self, request: RenderRequest) -> RenderResult:
        out_w, out_h = self.RESOLUTIONS[request.resolution]
        start = request.clip.start
        duration = request.clip.end - request.clip.start
        crop = self._crop_filter(request.crop_path)

        ass_path = self._escape_filter_path(request.caption_ass)
        vf = f"{crop},scale={out_w}:{out_h},ass={ass_path}"

        request.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.ffmpeg.run(
            [
                "-y",
                "-ss",
                str(start),
                "-i",
                str(request.source_video),
                "-t",
                str(duration),
                "-vf",
                vf,
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
                str(request.output_path),
            ]
        )
        return RenderResult(output_path=request.output_path, duration_sec=duration)
