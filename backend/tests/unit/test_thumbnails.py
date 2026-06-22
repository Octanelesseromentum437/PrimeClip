from unittest.mock import MagicMock

from app.db.models import Clip
from app.services.thumbnails import ensure_clip_thumbnail, thumbnail_path_for_clip


def test_thumbnail_path_for_clip(tmp_path):
    file_store = MagicMock()
    file_store.clips_output_dir.return_value = tmp_path
    clip = Clip(
        id="c1",
        job_id="j1",
        video_id="v1",
        index=3,
        title="Test",
        start_sec=0,
        end_sec=60,
        score=8.0,
        reason="test",
    )
    assert thumbnail_path_for_clip(file_store, clip) == tmp_path / "clip_03_thumb.jpg"


def test_ensure_clip_thumbnail_generates_from_output(tmp_path):
    video = tmp_path / "clip_01.mp4"
    video.write_bytes(b"not-a-real-video")

    file_store = MagicMock()
    file_store.clips_output_dir.return_value = tmp_path

    ffmpeg = MagicMock()
    ffmpeg.extract_frame.side_effect = lambda src, dest, **_: dest.write_bytes(b"jpeg")

    clip = Clip(
        id="c1",
        job_id="j1",
        video_id="v1",
        index=1,
        title="Test",
        start_sec=0,
        end_sec=60,
        score=8.0,
        reason="test",
        output_path=str(video),
    )

    result = ensure_clip_thumbnail(clip, file_store, ffmpeg)
    assert result == tmp_path / "clip_01_thumb.jpg"
    ffmpeg.extract_frame.assert_called_once()
