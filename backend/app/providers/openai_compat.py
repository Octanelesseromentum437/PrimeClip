import time

from app.config import Settings
from app.providers.json_utils import fallback_heuristic_clips, parse_clip_candidates, resolve_clip_candidates
from app.providers.ollama import build_clip_prompt
from app.schemas.clip import ClipCandidate, ClipSelectionRequest
from app.schemas.provider import ProviderConfig, ProviderHealth, ProviderKind
from openai import AsyncOpenAI

DEFAULT_BASE_URLS = {
    ProviderKind.OPENAI: "https://api.openai.com/v1",
    ProviderKind.OPENROUTER: "https://openrouter.ai/api/v1",
}


class OpenAICompatibleProvider:
    def __init__(self, settings: Settings, kind: ProviderKind) -> None:
        self.settings = settings
        self.kind = kind

    def _api_key(self, config: ProviderConfig) -> str:
        if config.api_key:
            return config.api_key.get_secret_value()
        if self.kind == ProviderKind.OPENAI:
            return self.settings.openai_api_key
        if self.kind == ProviderKind.OPENROUTER:
            return self.settings.openrouter_api_key
        return ""

    def _base_url(self, config: ProviderConfig) -> str:
        if config.base_url:
            return config.base_url.rstrip("/")
        return DEFAULT_BASE_URLS.get(self.kind, "")

    def _client(self, config: ProviderConfig) -> AsyncOpenAI:
        headers = dict(config.extra_headers)
        if self.kind == ProviderKind.OPENROUTER:
            headers.setdefault("HTTP-Referer", "https://github.com/lucianodiisouza/PrimeClip")
            headers.setdefault("X-Title", "PrimeClip")
        return AsyncOpenAI(
            api_key=self._api_key(config),
            base_url=self._base_url(config),
            default_headers=headers or None,
        )

    async def generate_clip_candidates(
        self,
        request: ClipSelectionRequest,
        config: ProviderConfig,
    ) -> list[ClipCandidate]:
        system, user = build_clip_prompt(request)
        client = self._client(config)
        for attempt in range(3):
            try:
                response = await client.chat.completions.create(
                    model=config.model,
                    temperature=0.2,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    response_format={"type": "json_object"},
                )
                content = response.choices[0].message.content or "[]"
                parsed = parse_clip_candidates(
                    content,
                    duration_sec=request.duration_sec,
                    num_clips=request.num_clips,
                )
                return resolve_clip_candidates(
                    parsed,
                    transcript=request.transcript,
                    scenes=request.scenes,
                    duration_sec=request.duration_sec,
                    num_clips=request.num_clips,
                    min_clip_sec=request.min_clip_sec,
                    max_clip_sec=request.max_clip_sec,
                )
            except Exception:
                import asyncio

                await asyncio.sleep(1.5 * (attempt + 1))

        return fallback_heuristic_clips(
            request.transcript,
            request.scenes,
            duration_sec=request.duration_sec,
            num_clips=request.num_clips,
            min_clip_sec=request.min_clip_sec,
            max_clip_sec=request.max_clip_sec,
        )

    async def health_check(self, config: ProviderConfig) -> ProviderHealth:
        if not self._api_key(config):
            return ProviderHealth(ok=False, error="API key not configured")
        start = time.perf_counter()
        try:
            client = self._client(config)
            await client.chat.completions.create(
                model=config.model,
                max_tokens=5,
                messages=[{"role": "user", "content": "ping"}],
            )
            return ProviderHealth(ok=True, latency_ms=(time.perf_counter() - start) * 1000)
        except Exception as exc:
            return ProviderHealth(ok=False, error=str(exc))
