from pathlib import Path
from typing import Literal

from app.config import Settings
from app.infra.dependencies import DependencyResolver
from app.schemas.transcript import TranscriptSegment
from faster_whisper import WhisperModel


class TranscriptionService:
    def __init__(self, settings: Settings, resolver: DependencyResolver) -> None:
        self.settings = settings
        self.resolver = resolver
        self._model: WhisperModel | None = None

    def _get_model(self) -> WhisperModel:
        if self._model is None:
            model_path = self.resolver.resolve_whisper_model()
            device = self.settings.whisper_device
            if device == "auto":
                device = "cpu"
            compute_type = "int8" if device == "cpu" else "float16"
            self._model = WhisperModel(model_path, device=device, compute_type=compute_type)
        return self._model

    def transcribe(
        self,
        audio_path: Path,
        *,
        language: Literal["en", "pt"] | None = None,
    ) -> list[TranscriptSegment]:
        model = self._get_model()
        segments_iter, info = model.transcribe(
            str(audio_path),
            language=language,
            beam_size=5,
            word_timestamps=True,
        )
        segments: list[TranscriptSegment] = []
        for seg in segments_iter:
            confidence = 1.0
            if seg.avg_logprob is not None:
                import math

                confidence = max(0.0, min(1.0, math.exp(seg.avg_logprob)))
            segments.append(
                TranscriptSegment(
                    start=seg.start,
                    end=seg.end,
                    text=seg.text.strip(),
                    confidence=confidence,
                )
            )
        return segments
