import asyncio
import logging
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from uuid import uuid4

from app.config import Settings

logger = logging.getLogger(__name__)

ALLOWED_URL_PATTERNS = (
    r"youtube\.com/watch",
    r"youtu\.be/",
    r"drive\.google\.com/",
    r"vimeo\.com/",
)


@dataclass
class ImportJobState:
    id: str
    url: str
    status: str = "queued"
    progress_pct: int = 0
    video_id: str | None = None
    filename: str | None = None
    error_message: str | None = None


_import_jobs: dict[str, ImportJobState] = {}


class UrlImportService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def validate_url(self, url: str) -> None:
        if not any(re.search(pattern, url) for pattern in ALLOWED_URL_PATTERNS):
            raise ValueError("URL host is not supported for import")

    def get_job(self, import_id: str) -> ImportJobState | None:
        return _import_jobs.get(import_id)

    def start_import(self, url: str) -> ImportJobState:
        self.validate_url(url)
        job = ImportJobState(id=str(uuid4()), url=url)
        _import_jobs[job.id] = job
        return job

    async def run_import(
        self,
        job: ImportJobState,
        *,
        register_video,
    ) -> None:
        job.status = "downloading"
        try:
            video_id = str(uuid4())
            dest_dir = self.settings.uploads_dir / video_id
            dest_dir.mkdir(parents=True, exist_ok=True)
            output_template = str(dest_dir / "source.%(ext)s")

            def hook(d: dict) -> None:
                if d.get("status") == "downloading":
                    total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                    downloaded = d.get("downloaded_bytes") or 0
                    if total:
                        job.progress_pct = min(99, int(downloaded / total * 100))

            await asyncio.to_thread(
                self._download,
                job.url,
                output_template,
                hook,
            )

            source_files = list(dest_dir.glob("source.*"))
            if not source_files:
                raise RuntimeError("Download completed but no video file was found")
            source_path = source_files[0]
            title = source_path.name

            response = await register_video(
                video_id=video_id,
                path=source_path,
                filename=title,
            )
            job.video_id = response.video_id
            job.filename = response.filename
            job.progress_pct = 100
            job.status = "completed"
        except Exception as exc:
            logger.exception("URL import failed for %s", job.url)
            job.status = "failed"
            job.error_message = str(exc)

    def _download(self, url: str, output_template: str, progress_hook) -> None:
        import yt_dlp

        ydl_opts: dict = {
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "outtmpl": output_template,
            "quiet": True,
            "noprogress": True,
            "progress_hooks": [progress_hook],
        }
        if self.settings.import_max_duration_sec:
            ydl_opts["match_filter"] = yt_dlp.utils.match_filter_func(
                f"duration < {self.settings.import_max_duration_sec}"
            )
        if self.settings.ytdlp_cookies_file:
            ydl_opts["cookiefile"] = self.settings.ytdlp_cookies_file

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

    def check_available(self) -> bool:
        if self.settings.ytdlp_path:
            return Path(self.settings.ytdlp_path).is_file()
        return shutil.which("yt-dlp") is not None or self._python_module_available()

    @staticmethod
    def _python_module_available() -> bool:
        try:
            import yt_dlp  # noqa: F401

            return True
        except ImportError:
            return False
