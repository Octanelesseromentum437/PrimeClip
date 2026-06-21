from pathlib import Path

from app.infra.ffmpeg import FFmpegService


class AudioExtractService:
    def __init__(self, ffmpeg: FFmpegService) -> None:
        self.ffmpeg = ffmpeg

    def extract(self, video_path: Path, output_path: Path) -> Path:
        return self.ffmpeg.extract_audio(video_path, output_path)
