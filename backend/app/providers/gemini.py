"""Future Gemini provider stub."""

from app.providers.openai_compat import OpenAICompatibleProvider
from app.schemas.provider import ProviderKind

# Gemini integration can extend OpenAICompatibleProvider or use google-genai SDK.


class GeminiProvider(OpenAICompatibleProvider):
    kind = ProviderKind.GEMINI
