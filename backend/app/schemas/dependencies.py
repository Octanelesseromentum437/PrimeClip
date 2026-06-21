from pydantic import BaseModel


class DependencyStatus(BaseModel):
    name: str
    ok: bool
    path: str | None = None
    message: str | None = None
    install_url: str | None = None


class DependencyReport(BaseModel):
    ffmpeg: DependencyStatus
    whisper_model: DependencyStatus
    ollama: DependencyStatus
