from app.config import Settings
from app.providers.claude import ClaudeProvider
from app.providers.ollama import OllamaProvider
from app.providers.openai_compat import OpenAICompatibleProvider
from app.schemas.provider import ProviderConfig, ProviderDescriptor, ProviderKind

PRESETS: list[ProviderDescriptor] = [
    ProviderDescriptor(
        kind=ProviderKind.OLLAMA,
        display_name="Ollama (Local)",
        requires_api_key=False,
        default_model="qwen3",
    ),
    ProviderDescriptor(
        kind=ProviderKind.CLAUDE,
        display_name="Claude (Anthropic)",
        requires_api_key=True,
        default_model="claude-sonnet-4-20250514",
    ),
    ProviderDescriptor(
        kind=ProviderKind.OPENAI,
        display_name="OpenAI",
        requires_api_key=True,
        default_model="gpt-4o",
    ),
    ProviderDescriptor(
        kind=ProviderKind.OPENROUTER,
        display_name="OpenRouter",
        requires_api_key=True,
        default_model="openai/gpt-4o",
    ),
    ProviderDescriptor(
        kind=ProviderKind.CUSTOM,
        display_name="Custom (OpenAI-compatible)",
        requires_api_key=True,
        default_model="",
    ),
]


class ProviderRegistry:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._ollama = OllamaProvider()
        self._claude = ClaudeProvider(settings)
        self._openai = OpenAICompatibleProvider(settings, ProviderKind.OPENAI)
        self._openrouter = OpenAICompatibleProvider(settings, ProviderKind.OPENROUTER)
        self._custom = OpenAICompatibleProvider(settings, ProviderKind.CUSTOM)

    def create(self, config: ProviderConfig):
        mapping = {
            ProviderKind.OLLAMA: self._ollama,
            ProviderKind.CLAUDE: self._claude,
            ProviderKind.OPENAI: self._openai,
            ProviderKind.OPENROUTER: self._openrouter,
            ProviderKind.GEMINI: self._custom,
            ProviderKind.CUSTOM: self._custom,
        }
        provider = mapping.get(config.kind)
        if provider is None:
            raise ValueError(f"Unknown provider kind: {config.kind}")
        return provider

    async def list_descriptors(
        self,
        *,
        configured_kinds: set[ProviderKind] | None = None,
    ) -> list[ProviderDescriptor]:
        configured_kinds = configured_kinds or set()
        descriptors: list[ProviderDescriptor] = []
        for preset in PRESETS:
            desc = preset.model_copy()
            if desc.kind == ProviderKind.OLLAMA:
                health = await self._ollama.health_check(
                    ProviderConfig(kind=ProviderKind.OLLAMA, model=desc.default_model)
                )
                if health.ok:
                    models = await self._ollama.list_models(
                        ProviderConfig(
                            kind=ProviderKind.OLLAMA,
                            model=desc.default_model,
                            base_url=self.settings.ollama_url,
                        )
                    )
                    desc.models = models
                desc.configured = health.ok
            else:
                desc.configured = desc.kind in configured_kinds
            descriptors.append(desc)
        return descriptors
