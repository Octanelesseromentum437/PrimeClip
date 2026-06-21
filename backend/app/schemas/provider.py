from enum import StrEnum

from pydantic import BaseModel, Field, SecretStr


class ProviderKind(StrEnum):
    OLLAMA = "ollama"
    CLAUDE = "claude"
    OPENAI = "openai"
    OPENROUTER = "openrouter"
    GEMINI = "gemini"
    CUSTOM = "custom"


class ProviderConfig(BaseModel):
    kind: ProviderKind
    model: str
    api_key: SecretStr | None = None
    base_url: str | None = None
    extra_headers: dict[str, str] = Field(default_factory=dict)


class ProviderDescriptor(BaseModel):
    kind: ProviderKind
    display_name: str
    requires_api_key: bool
    default_model: str
    models: list[str] = Field(default_factory=list)
    configured: bool = False


class ProviderHealth(BaseModel):
    ok: bool
    latency_ms: float | None = None
    error: str | None = None


class ProviderTestRequest(BaseModel):
    config: ProviderConfig
