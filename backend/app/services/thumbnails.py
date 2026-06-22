from pathlib import Path

from app.db.models import Clip
from app.infra.ffmpeg import FFmpegService
from app.infra.storage import FileStore


def thumbnail_path_for_clip(file_store: FileStore, clip: Clip) -> Path:
    output_dir = file_store.clips_output_dir(clip.video_id)
    return output_dir / f"clip_{clip.index:02d}_thumb.jpg"


def resolve_video_for_thumbnail(clip: Clip, file_store: FileStore) -> Path | None:
    if clip.output_path:
        output = Path(clip.output_path)
        if output.is_file():
            return output

    output_dir = file_store.clips_output_dir(clip.video_id)
    preview = output_dir / f"clip_{clip.index:02d}_preview_1080x1920.mp4"
    if preview.is_file():
        return preview
    preview = output_dir / f"clip_{clip.index:02d}_preview_1920x1080.mp4"
    if preview.is_file():
        return preview

    legacy = output_dir / f"clip_{clip.index:02d}.mp4"
    return legacy if legacy.is_file() else None


def ensure_clip_thumbnail(
    clip: Clip,
    file_store: FileStore,
    ffmpeg: FFmpegService,
) -> Path | None:
    if clip.thumbnail_path:
        stored = Path(clip.thumbnail_path)
        if stored.is_file():
            return stored

    thumb_path = thumbnail_path_for_clip(file_store, clip)
    if thumb_path.is_file():
        return thumb_path

    source = resolve_video_for_thumbnail(clip, file_store)
    if source is None:
        return None

    try:
        ffmpeg.extract_frame(source, thumb_path, timestamp_sec=1.0)
    except Exception:
        return None

    return thumb_path if thumb_path.is_file() else None
