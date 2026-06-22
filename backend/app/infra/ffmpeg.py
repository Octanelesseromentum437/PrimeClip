import json
import subprocess
from pathlib import Path

from app.infra.dependencies import DependencyResolver


class FFmpegError(RuntimeError):
    pass


class FFmpegService:
    def __init__(self, resolver: DependencyResolver) -> None:
        self.resolver = resolver

    @property
    def ffmpeg(self) -> Path:
        return self.resolver.resolve_ffmpeg()

    def run(self, args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
        cmd = [str(self.ffmpeg), *args]
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if check and result.returncode != 0:
            raise FFmpegError(result.stderr or result.stdout or "ffmpeg failed")
        return result

    def _resolve_ffprobe(self) -> Path | None:
        ffprobe = self.ffmpeg.parent / ("ffprobe.exe" if self.ffmpeg.suffix else "ffprobe")
        if ffprobe.is_file():
            return ffprobe
        ffprobe_path = self.ffmpeg.with_name("ffprobe" + self.ffmpeg.suffix)
        return ffprobe_path if ffprobe_path.is_file() else None

    def probe_duration(self, video_path: Path) -> float:
        ffprobe = self._resolve_ffprobe()
        if ffprobe:
            result = subprocess.run(
                [
                    str(ffprobe),
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "json",
                    str(video_path),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0:
                try:
                    data = json.loads(result.stdout)
                    return float(data["format"]["duration"])
                except (json.JSONDecodeError, KeyError, ValueError):
                    pass

        probe = subprocess.run(
            [str(self.ffmpeg), "-i", str(video_path)],
            capture_output=True,
            text=True,
            check=False,
        )
        import re

        match = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", probe.stderr)
        if not match:
            raise FFmpegError("Could not determine video duration") from None
        h, m, s = match.groups()
        return int(h) * 3600 + int(m) * 60 + float(s)

    def probe_dimensions(self, video_path: Path) -> tuple[int, int]:
        ffprobe = self._resolve_ffprobe()
        if ffprobe:
            result = subprocess.run(
                [
                    str(ffprobe),
                    "-v",
                    "error",
                    "-select_streams",
                    "v:0",
                    "-show_entries",
                    "stream=width,height",
                    "-of",
                    "json",
                    str(video_path),
                ],
                capture_output=True,
                text=True,
                check=True,
            )
            data = json.loads(result.stdout)
            stream = data["streams"][0]
            return int(stream["width"]), int(stream["height"])
        return 1920, 1080

    def probe_rotation(self, video_path: Path) -> int:
        ffprobe = self._resolve_ffprobe()
        if not ffprobe:
            return 0
        result = subprocess.run(
            [
                str(ffprobe),
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream_side_data=rotation:stream_tags=rotate",
                "-of",
                "json",
                str(video_path),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            return 0
        try:
            data = json.loads(result.stdout)
            stream = data.get("streams", [{}])[0]
            side_data = stream.get("side_data_list") or []
            for entry in side_data:
                if "rotation" in entry:
                    return int(float(entry["rotation"]))
            tags = stream.get("tags") or {}
            if "rotate" in tags:
                return int(tags["rotate"])
        except (json.JSONDecodeError, KeyError, ValueError, IndexError):
            pass
        return 0

    def normalize_rotation(self, video_path: Path) -> Path:
        rotation = self.probe_rotation(video_path)
        rotation = rotation % 360
        if rotation == 0:
            return video_path

        transpose_map = {90: "transpose=1", 180: "transpose=1,transpose=1", 270: "transpose=2"}
        vf = transpose_map.get(rotation)
        if vf is None:
            return video_path

        normalized = video_path.parent / "source_normalized.mp4"
        self.run(
            [
                "-y",
                "-i",
                str(video_path),
                "-vf",
                vf,
                "-c:v",
                "libx264",
                "-preset",
                "fast",
                "-crf",
                "18",
                "-c:a",
                "copy",
                str(normalized),
            ]
        )
        return normalized

    def extract_audio(self, video_path: Path, output_path: Path) -> Path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        self.run(
            [
                "-y",
                "-i",
                str(video_path),
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ar",
                "16000",
                "-ac",
                "1",
                str(output_path),
            ]
        )
        return output_path
