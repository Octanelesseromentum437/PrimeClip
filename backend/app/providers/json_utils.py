import json
import re

from app.schemas.clip import ClipCandidate
from app.schemas.scene import Scene
from app.schemas.transcript import TranscriptSegment
from json_repair import repair_json
from pydantic import ValidationError


def extract_json_array(text: str) -> str:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        return fence.group(1).strip()
    start = text.find("[")
    end = text.rfind("]")
    if start >= 0 and end > start:
        return text[start : end + 1]
    return text


def parse_clip_candidates(
    raw: str,
    *,
    duration_sec: float,
    num_clips: int,
) -> list[ClipCandidate]:
    cleaned = extract_json_array(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        data = json.loads(repair_json(cleaned))

    if isinstance(data, dict) and "clips" in data:
        data = data["clips"]

    if not isinstance(data, list):
        raise ValueError("Expected JSON array of clip candidates")

    candidates: list[ClipCandidate] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        try:
            start = float(item.get("start", 0))
            end = float(item.get("end", 0))
            start = max(0.0, min(start, duration_sec))
            end = max(0.0, min(end, duration_sec))
            candidate = ClipCandidate(
                title=str(item.get("title", "Untitled Clip")),
                start=start,
                end=end,
                score=float(item.get("score", 5.0)),
                reason=str(item.get("reason", "")),
            )
            candidates.append(candidate)
        except (ValidationError, TypeError, ValueError):
            continue

    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates[:num_clips]


def fallback_heuristic_clips(
    transcript: list[TranscriptSegment],
    scenes: list[Scene],
    *,
    duration_sec: float,
    num_clips: int,
    min_clip_sec: float = 30,
    max_clip_sec: float = 90,
) -> list[ClipCandidate]:
    """Word-density windows when LLM fails."""
    if not transcript:
        return []

    windows: list[tuple[float, float, float]] = []
    for scene in scenes or [Scene(start=0, end=duration_sec)]:
        scene_segs = [s for s in transcript if s.end > scene.start and s.start < scene.end]
        if not scene_segs:
            continue
        window = min_clip_sec
        step = 15.0
        t = scene.start
        while t + window <= scene.end:
            w_end = t + window
            segs = [s for s in scene_segs if s.end > t and s.start < w_end]
            word_count = sum(len(s.text.split()) for s in segs)
            density = word_count / window
            windows.append((t, w_end, density))
            t += step

    if not windows:
        start = transcript[0].start
        end = min(start + 60, duration_sec)
        windows = [(start, end, 1.0)]

    windows.sort(key=lambda w: w[2], reverse=True)
    candidates: list[ClipCandidate] = []
    used_ranges: list[tuple[float, float]] = []

    for start, end, density in windows:
        if any(not (end <= u_start or start >= u_end) for u_start, u_end in used_ranges):
            continue
        dur = end - start
        if dur < min_clip_sec:
            end = min(start + min_clip_sec, duration_sec)
        if end - start > max_clip_sec:
            end = start + max_clip_sec
        try:
            candidates.append(
                ClipCandidate(
                    title=f"Highlight at {int(start)}s",
                    start=start,
                    end=end,
                    score=min(10.0, 5.0 + density),
                    reason="Heuristic fallback: high speech density window",
                )
            )
            used_ranges.append((start, end))
        except ValidationError:
            continue
        if len(candidates) >= num_clips:
            break

    return candidates
