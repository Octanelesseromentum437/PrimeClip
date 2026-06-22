from unittest.mock import MagicMock

import numpy as np
from app.db.models import Clip
from app.services.media_cache import (
    _compute_peaks,
    filmstrip_path_for_clip,
    waveform_path_for_clip,
)


def test_filmstrip_path_for_clip(tmp_path):
    file_store = MagicMock()
    file_store.clips_output_dir.return_value = tmp_path
    clip = Clip(
        id="c1",
        job_id="j1",
        video_id="v1",
        index=2,
        title="Test",
        start_sec=0,
        end_sec=30,
        score=8.0,
        reason="test",
    )
    path = filmstrip_path_for_clip(
        file_store,
        clip,
        start_sec=1.5,
        end_sec=10.0,
        frame_count=8,
        height=48,
    )
    assert path.name == "clip_02_filmstrip_1.50_10.00_8_48.jpg"


def test_waveform_path_for_clip(tmp_path):
    file_store = MagicMock()
    file_store.clips_output_dir.return_value = tmp_path
    clip = Clip(
        id="c1",
        job_id="j1",
        video_id="v1",
        index=1,
        title="Test",
        start_sec=0,
        end_sec=30,
        score=8.0,
        reason="test",
    )
    assert waveform_path_for_clip(file_store, clip) == tmp_path / "clip_01_waveform.json"


def test_compute_peaks_downsamples():
    samples = np.array([0.0, 1.0, -0.5, 0.25, -0.75, 0.5], dtype=np.float32)
    peaks = _compute_peaks(samples, target_samples=3)
    assert len(peaks) == 3
    assert peaks[0] == 1.0
    assert peaks[1] == 0.5
    assert peaks[2] == 0.75


def test_compute_peaks_empty_tail():
    samples = np.array([0.2, -0.3], dtype=np.float32)
    peaks = _compute_peaks(samples, target_samples=4)
    assert len(peaks) == 4
    assert peaks[2] == 0.0
    assert peaks[3] == 0.0
