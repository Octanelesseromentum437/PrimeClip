import platform
import shutil
import subprocess
import sys
from pathlib import Path

import httpx
from app.config import Settings
from app.schemas.common import BundleProfile
from app.schemas.dependencies import DependencyReport, DependencyStatus

FFMPEG_FULL_HINT = (
    "FFmpeg is missing the ass/subtitles filter (libass). On macOS: brew install ffmpeg-full"
)


class DependencyResolver:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.profile = settings.bundle_profile

    def _bundled_ffmpeg(self) -> Path | None:
        system = platform.system().lower()
        machine = platform.machine().lower()
        if system == "darwin":
            sub = "macos-arm64" if machine == "arm64" else "macos-x64"
        elif system == "windows":
            sub = "windows"
        else:
            sub = "linux"
        base = self.settings.bundled_resources_dir / "ffmpeg" / sub
        name = "ffmpeg.exe" if system == "windows" else "ffmpeg"
        candidate = base / name
        return candidate if candidate.is_file() else None

    def _ffmpeg_has_ass_filter(self, ffmpeg: Path) -> bool:
        result = subprocess.run(
            [str(ffmpeg), "-h", "filter=ass"],
            capture_output=True,
            text=True,
            check=False,
        )
        return result.returncode == 0 and "Unknown filter" not in (result.stdout + result.stderr)

    def _system_ffmpeg_candidates(self) -> list[Path]:
        candidates: list[Path] = []
        seen: set[str] = set()

        def add(candidate: Path | str | None) -> None:
            if not candidate:
                return
            path = Path(candidate)
            key = str(path.resolve())
            if path.is_file() and key not in seen:
                seen.add(key)
                candidates.append(path)

        add(shutil.which("ffmpeg"))
        for prefix in ("/opt/homebrew/opt", "/usr/local/opt"):
            add(f"{prefix}/ffmpeg-full/bin/ffmpeg")
            add(f"{prefix}/ffmpeg@7/bin/ffmpeg")
        return candidates

    def resolve_ffmpeg(self) -> Path:
        if self.profile == BundleProfile.FULL:
            bundled = self._bundled_ffmpeg()
            if bundled:
                return bundled
        if self.settings.ffmpeg_path:
            path = Path(self.settings.ffmpeg_path)
            if path.is_file():
                return path
            raise FileNotFoundError(f"FFmpeg not found at {path}")

        candidates = self._system_ffmpeg_candidates()
        if not candidates:
            raise FileNotFoundError(
                "FFmpeg not found. Install FFmpeg or set FFMPEG_PATH in Settings."
            )

        for candidate in candidates:
            if self._ffmpeg_has_ass_filter(candidate):
                return candidate
        return candidates[0]

    def resolve_whisper_model(self) -> str:
        if self.profile == BundleProfile.FULL:
            bundled = self.settings.bundled_resources_dir / "whisper" / self.settings.whisper_model
            if bundled.exists():
                return str(bundled)
        user_model = self.settings.models_dir / self.settings.whisper_model
        if user_model.exists():
            return str(user_model)
        return self.settings.whisper_model

    def check_ffmpeg(self) -> DependencyStatus:
        try:
            path = self.resolve_ffmpeg()
            if not self._ffmpeg_has_ass_filter(path):
                return DependencyStatus(
                    name="ffmpeg",
                    ok=False,
                    path=str(path),
                    message=FFMPEG_FULL_HINT,
                    install_url="https://formulae.brew.sh/formula/ffmpeg-full",
                )
            return DependencyStatus(name="ffmpeg", ok=True, path=str(path))
        except FileNotFoundError as exc:
            return DependencyStatus(
                name="ffmpeg",
                ok=False,
                message=str(exc),
                install_url="https://ffmpeg.org/download.html",
            )

    def check_whisper_model(self) -> DependencyStatus:
        model = self.resolve_whisper_model()
        path = Path(model)
        if path.exists():
            return DependencyStatus(name="whisper_model", ok=True, path=str(path))
        return DependencyStatus(
            name="whisper_model",
            ok=True,
            path=model,
            message="Will download on first transcription run",
        )

    def check_ollama(self) -> DependencyStatus:
        url = self.settings.ollama_url.rstrip("/")
        try:
            with httpx.Client(timeout=3.0) as client:
                resp = client.get(f"{url}/api/tags")
                if resp.status_code == 200:
                    return DependencyStatus(name="ollama", ok=True, path=url)
        except Exception:
            pass
        return DependencyStatus(
            name="ollama",
            ok=False,
            path=url,
            message="Ollama not reachable (optional if using cloud LLM)",
            install_url="https://ollama.com/download",
        )

    def check_ytdlp(self) -> DependencyStatus:
        from app.services.url_import.url_import import UrlImportService

        service = UrlImportService(self.settings)
        if service.check_available():
            message = "yt-dlp available"
            if not service.check_js_runtime():
                message += " (install Deno or Node for reliable YouTube imports)"
            return DependencyStatus(name="ytdlp", ok=True, message=message)
        return DependencyStatus(
            name="ytdlp",
            ok=False,
            message="yt-dlp not installed (optional for URL import)",
            install_url="https://github.com/yt-dlp/yt-dlp#installation",
        )

    def check_all(self) -> DependencyReport:
        return DependencyReport(
            ffmpeg=self.check_ffmpeg(),
            whisper_model=self.check_whisper_model(),
            ollama=self.check_ollama(),
            ytdlp=self.check_ytdlp(),
        )


def get_bundle_profile_from_env() -> BundleProfile:
    import os

    raw = os.getenv("BUNDLE_PROFILE", "lite").lower()
    return BundleProfile.FULL if raw == "full" else BundleProfile.LITE


def is_frozen() -> bool:
    return getattr(sys, "frozen", False)
