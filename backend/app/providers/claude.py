import time

from anthropic import AsyncAnthropic
from app.config import Settings
from app.providers.json_utils import fallback_heuristic_clips, parse_clip_candidates, resolve_clip_candidates
from app.providers.ollama import build_clip_prompt
from app.schemas.clip import ClipCandidate, ClipSelectionRequest
from app.schemas.provider import ProviderConfig, ProviderHealth, ProviderKind


class ClaudeProvider:
    kind = ProviderKind.CLAUDE

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _api_key(self, config: ProviderConfig) -> str:
        if config.api_key:
            return config.api_key.get_secret_value()
        return self.settings.claude_api_key

    async def generate_clip_candidates(
        self,
        request: ClipSelectionRequest,
        config: ProviderConfig,
    ) -> list[ClipCandidate]:
        system, user = build_clip_prompt(request)
        client = AsyncAnthropic(api_key=self._api_key(config))
        for attempt in range(3):
            try:
                message = await client.messages.create(
                    model=config.model,
                    max_tokens=4096,
                    temperature=0.2,
                    system=system,
                    messages=[{"role": "user", "content": user}],
                )
                content = message.content[0].text
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
            client = AsyncAnthropic(api_key=self._api_key(config))
            await client.messages.create(
                model=config.model,
                max_tokens=16,
                messages=[{"role": "user", "content": "ping"}],
            )
            return ProviderHealth(ok=True, latency_ms=(time.perf_counter() - start) * 1000)
        except Exception as exc:
            return ProviderHealth(ok=False, error=str(exc))
