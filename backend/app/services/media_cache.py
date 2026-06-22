import json
import math
from pathlib import Path

import numpy as np
from app.db.models import Clip
from app.infra.ffmpeg import FFmpegService
from app.infra.storage import FileStore
from app.schemas.common import Resolution
from app.services.captions.rerender import ClipRerenderService

MAX_FILMSTRIP_FRAMES = 60
DEFAULT_WAVEFORM_SAMPLES = 1200


def filmstrip_path_for_clip(
    file_store: FileStore,
    clip: Clip,
    *,
    start_sec: float,
    end_sec: float,
    frame_count: int,
    height: int,
) -> Path:
    output_dir = file_store.clips_output_dir(clip.video_id)
    return output_dir / (
        f"clip_{clip.index:02d}_filmstrip_{start_sec:.2f}_{end_sec:.2f}_{frame_count}_{height}.jpg"
    )


def waveform_path_for_clip(file_store: FileStore, clip: Clip) -> Path:
    output_dir = file_store.clips_output_dir(clip.video_id)
    return output_dir / f"clip_{clip.index:02d}_waveform.json"


def ensure_clip_filmstrip(
    clip: Clip,
    source_video: Path,
    file_store: FileStore,
    ffmpeg: FFmpegService,
    rerender_svc: ClipRerenderService,
    *,
    start_sec: float,
    end_sec: float,
    frame_count: int,
    height: int,
    resolution: Resolution = Resolution.SD,
) -> Path:
    frame_count = max(1, min(frame_count, MAX_FILMSTRIP_FRAMES))
    height = max(16, min(height, 256))
    start = max(0.0, start_sec)
    end = max(start + 0.05, end_sec)

    output_path = filmstrip_path_for_clip(
        file_store,
        clip,
        start_sec=start,
        end_sec=end,
        frame_count=frame_count,
        height=height,
    )
    if output_path.is_file():
        return output_path

    preview_path = rerender_svc.ensure_preview(
        clip,
        source_video,
        resolution=resolution,
    )
    preview_duration = ffmpeg.probe_duration(preview_path)
    end = min(end, preview_duration)
    if end <= start:
        end = min(preview_duration, start + 0.1)

    ffmpeg.extract_filmstrip(
        preview_path,
        output_path,
        start_sec=start,
        end_sec=end,
        frame_count=frame_count,
        height=height,
    )
    return output_path


def _compute_peaks(samples: np.ndarray, target_samples: int) -> list[float]:
    count = max(1, target_samples)
    block_size = max(1, math.floor(len(samples) / count))
    peaks: list[float] = []
    for i in range(count):
        start = i * block_size
        end = min(start + block_size, len(samples))
        if start >= len(samples):
            peaks.append(0.0)
            continue
        block = samples[start:end]
        peaks.append(float(np.max(np.abs(block))))
    return peaks


def ensure_clip_waveform(
    clip: Clip,
    source_video: Path,
    file_store: FileStore,
    ffmpeg: FFmpegService,
    rerender_svc: ClipRerenderService,
    *,
    resolution: Resolution = Resolution.SD,
    target_samples: int = DEFAULT_WAVEFORM_SAMPLES,
) -> dict[str, object]:
    cache_path = waveform_path_for_clip(file_store, clip)
    if cache_path.is_file():
        return json.loads(cache_path.read_text(encoding="utf-8"))

    preview_path = rerender_svc.ensure_preview(
        clip,
        source_video,
        resolution=resolution,
    )
    duration = ffmpeg.probe_duration(preview_path)
    pcm, _sample_rate = ffmpeg.extract_audio_f32(preview_path)
    samples = np.frombuffer(pcm, dtype=np.float32)
    peaks = _compute_peaks(samples, target_samples)
    payload = {"peaks": peaks, "duration": duration}
    cache_path.write_text(json.dumps(payload), encoding="utf-8")
    return payload
