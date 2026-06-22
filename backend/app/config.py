from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.schemas.common import BundleProfile


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    claude_api_key: str = ""
    openai_api_key: str = ""
    openrouter_api_key: str = ""
    ollama_url: str = "http://localhost:11434"
    whisper_model: str = "base"
    whisper_device: str = "auto"
    output_dir: Path = Path("./outputs")
    database_url: str = "sqlite:///./outputs/primeclip.db"
    sidecar_host: str = "127.0.0.1"
    sidecar_port: int = 8765
    ffmpeg_path: str = ""
    bundle_profile: BundleProfile = BundleProfile.LITE
    primeclip_debug: bool = False
    scene_threshold: float = 0.3
    scene_min_len_sec: float = 2.0
    ytdlp_path: str = ""
    import_max_duration_sec: int = 7200
    ytdlp_cookies_file: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""

    @property
    def uploads_dir(self) -> Path:
        return self.output_dir / "uploads"

    @property
    def artifacts_dir(self) -> Path:
        return self.output_dir / "artifacts"

    @property
    def clips_dir(self) -> Path:
        return self.output_dir / "clips"

    @property
    def models_dir(self) -> Path:
        return self.output_dir / "models"

    @property
    def bundled_resources_dir(self) -> Path:
        return Path(__file__).resolve().parents[3] / "resources"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.output_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    settings.artifacts_dir.mkdir(parents=True, exist_ok=True)
    settings.clips_dir.mkdir(parents=True, exist_ok=True)
    settings.models_dir.mkdir(parents=True, exist_ok=True)
    return settings
