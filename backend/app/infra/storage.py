import json
import shutil
from pathlib import Path
from uuid import uuid4

from app.config import Settings


class FileStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def video_upload_dir(self, video_id: str) -> Path:
        path = self.settings.uploads_dir / video_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def artifact_dir(self, video_id: str) -> Path:
        path = self.settings.artifacts_dir / video_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def clips_output_dir(self, video_id: str) -> Path:
        path = self.settings.clips_dir / video_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def save_upload(self, filename: str, data: bytes) -> tuple[str, Path]:
        video_id = str(uuid4())
        dest_dir = self.video_upload_dir(video_id)
        ext = Path(filename).suffix or ".mp4"
        dest = dest_dir / f"source{ext}"
        dest.write_bytes(data)
        return video_id, dest

    def save_upload_from_path(self, source: Path) -> tuple[str, Path]:
        video_id = str(uuid4())
        dest_dir = self.video_upload_dir(video_id)
        ext = source.suffix or ".mp4"
        dest = dest_dir / f"source{ext}"
        shutil.copy2(source, dest)
        return video_id, dest

    def write_json_artifact(self, video_id: str, name: str, payload: object) -> Path:
        path = self.artifact_dir(video_id) / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
        return path

    def read_json_artifact(self, video_id: str, name: str) -> object:
        path = self.artifact_dir(video_id) / name
        return json.loads(path.read_text(encoding="utf-8"))

    def delete_video_data(self, video_id: str) -> None:
        for directory in (
            self.settings.uploads_dir / video_id,
            self.settings.artifacts_dir / video_id,
            self.settings.clips_dir / video_id,
        ):
            if directory.is_dir():
                shutil.rmtree(directory, ignore_errors=True)
