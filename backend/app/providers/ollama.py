import time
from pathlib import Path

import httpx
from app.providers.json_utils import fallback_heuristic_clips, parse_clip_candidates, resolve_clip_candidates
from app.schemas.clip import ClipCandidate, ClipSelectionRequest
from app.schemas.provider import ProviderConfig, ProviderHealth, ProviderKind
from app.schemas.transcript import TranscriptSegment

PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"


def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text(encoding="utf-8")


def _format_transcript(transcript: list) -> str:
    lines = []
    for seg in transcript:
        if isinstance(seg, TranscriptSegment):
            lines.append(f"[{seg.start:.1f}-{seg.end:.1f}] {seg.text}")
        elif isinstance(seg, dict):
            lines.append(f"[{seg['start']:.1f}-{seg['end']:.1f}] {seg['text']}")
    return "\n".join(lines)


def _format_scenes(scenes: list) -> str:
    lines = []
    for s in scenes:
        if hasattr(s, "start"):
            lines.append(f"{s.start:.1f}-{s.end:.1f}")
        else:
            lines.append(f"{s['start']:.1f}-{s['end']:.1f}")
    return "\n".join(lines)


def build_clip_prompt(request: ClipSelectionRequest) -> tuple[str, str]:
    system = _load_prompt("clip_selection_system.txt")
    user_template = _load_prompt("clip_selection.txt")
    user = user_template.format(
        num_clips=request.num_clips,
        duration_sec=request.duration_sec,
        language=request.language,
        transcript=_format_transcript(request.transcript),
        scenes=_format_scenes(request.scenes),
    )
    return system, user


class OllamaProvider:
    kind = ProviderKind.OLLAMA

    async def generate_clip_candidates(
        self,
        request: ClipSelectionRequest,
        config: ProviderConfig,
    ) -> list[ClipCandidate]:
        system, user = build_clip_prompt(request)
        base_url = (config.base_url or "http://localhost:11434").rstrip("/")
        payload = {
            "model": config.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.2},
        }
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    resp = await client.post(f"{base_url}/api/chat", json=payload)
                    resp.raise_for_status()
                    content = resp.json()["message"]["content"]
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
        base_url = (config.base_url or "http://localhost:11434").rstrip("/")
        start = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{base_url}/api/tags")
                resp.raise_for_status()
            return ProviderHealth(ok=True, latency_ms=(time.perf_counter() - start) * 1000)
        except Exception as exc:
            return ProviderHealth(ok=False, error=str(exc))

    async def list_models(self, config: ProviderConfig) -> list[str]:
        base_url = (config.base_url or "http://localhost:11434").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{base_url}/api/tags")
                resp.raise_for_status()
                data = resp.json()
                return [m["name"] for m in data.get("models", [])]
        except Exception:
            return []
