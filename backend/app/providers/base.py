from typing import Protocol

from app.schemas.clip import ClipCandidate, ClipSelectionRequest
from app.schemas.provider import ProviderConfig, ProviderHealth, ProviderKind


class LLMProvider(Protocol):
    kind: ProviderKind

    async def generate_clip_candidates(
        self,
        request: ClipSelectionRequest,
        config: ProviderConfig,
    ) -> list[ClipCandidate]:
        ...

    async def health_check(self, config: ProviderConfig) -> ProviderHealth:
        ...
