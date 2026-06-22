import pytest
from app.providers.json_utils import (
    extract_json_array,
    fallback_heuristic_clips,
    parse_clip_candidates,
    resolve_clip_candidates,
)
from app.schemas.clip import ClipCandidate
from app.schemas.scene import Scene
from app.schemas.transcript import TranscriptSegment
from pydantic import ValidationError


def test_extract_json_from_fence():
    raw = '```json\n[{"title":"A","start":0,"end":45,"score":9,"reason":"hook"}]\n```'
    assert extract_json_array(raw).startswith("[")


def test_parse_clip_candidates_valid():
    raw = '[{"title":"Test","start":10,"end":50,"score":8.5,"reason":"great hook"}]'
    clips = parse_clip_candidates(raw, duration_sec=120, num_clips=5)
    assert len(clips) == 1
    assert clips[0].title == "Test"


def test_clip_candidate_duration_validation():
    with pytest.raises(ValidationError):
        ClipCandidate(title="Bad", start=0, end=20, score=5, reason="too short")


def test_fallback_heuristic():
    transcript = [
        TranscriptSegment(start=0, end=10, text="hello world " * 20, confidence=0.9),
        TranscriptSegment(start=10, end=60, text="more content " * 50, confidence=0.9),
    ]
    scenes = [Scene(start=0, end=120)]
    clips = fallback_heuristic_clips(transcript, scenes, duration_sec=120, num_clips=2)
    assert len(clips) >= 1
    for clip in clips:
        assert 30 <= clip.end - clip.start <= 90


def test_resolve_clip_candidates_falls_back_on_empty():
    transcript = [
        TranscriptSegment(start=0, end=10, text="hello world " * 20, confidence=0.9),
        TranscriptSegment(start=10, end=60, text="more content " * 50, confidence=0.9),
    ]
    scenes = [Scene(start=0, end=120)]
    clips = resolve_clip_candidates(
        [],
        transcript=transcript,
        scenes=scenes,
        duration_sec=120,
        num_clips=2,
    )
    assert len(clips) >= 1
