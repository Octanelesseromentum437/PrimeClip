from app.schemas.caption import CaptionCue, CaptionStyle
from app.schemas.transcript import TranscriptSegment, WordSegment


class CaptionChunker:
    def chunk_segments(
        self,
        segments: list[TranscriptSegment],
        clip_range: tuple[float, float],
        style: CaptionStyle,
    ) -> list[CaptionCue]:
        start, end = clip_range
        words = self._collect_words(segments, start, end)
        if not words:
            return self._fallback_segment_cues(segments, start, end)
        return self._chunk_words(words, style.words_per_screen)

    def _collect_words(
        self,
        segments: list[TranscriptSegment],
        start: float,
        end: float,
    ) -> list[WordSegment]:
        words: list[WordSegment] = []
        for seg in segments:
            if seg.end <= start or seg.start >= end:
                continue
            if seg.words:
                for word in seg.words:
                    if word.end > start and word.start < end:
                        words.append(
                            WordSegment(
                                word=word.word.strip(),
                                start=max(0.0, word.start - start),
                                end=min(end - start, word.end - start),
                            )
                        )
            elif seg.text.strip():
                words.append(
                    WordSegment(
                        word=seg.text.strip(),
                        start=max(0.0, seg.start - start),
                        end=min(end - start, seg.end - start),
                    )
                )
        return [w for w in words if w.word and w.end > w.start]

    def _chunk_words(self, words: list[WordSegment], words_per_screen: int) -> list[CaptionCue]:
        cues: list[CaptionCue] = []
        chunk_size = max(1, words_per_screen)
        for i in range(0, len(words), chunk_size):
            chunk = words[i : i + chunk_size]
            text = " ".join(w.word for w in chunk)
            cues.append(
                CaptionCue(
                    start=chunk[0].start,
                    end=chunk[-1].end,
                    text=text,
                )
            )
        return cues

    def _fallback_segment_cues(
        self,
        segments: list[TranscriptSegment],
        start: float,
        end: float,
    ) -> list[CaptionCue]:
        cues: list[CaptionCue] = []
        for seg in segments:
            if seg.end <= start or seg.start >= end:
                continue
            cues.append(
                CaptionCue(
                    start=max(0.0, seg.start - start),
                    end=min(end - start, seg.end - start),
                    text=seg.text.replace("\n", " ").strip(),
                )
            )
        return [c for c in cues if c.text and c.end > c.start]
