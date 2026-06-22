import json
from pathlib import Path

from app.schemas.caption import CaptionEditState


class CaptionEditStore:
    def path_for_clip(self, artifact_dir: Path, clip_index: int) -> Path:
        return artifact_dir / f"clip_{clip_index:02d}" / "caption_edit.json"

    def load(self, path: Path) -> CaptionEditState | None:
        if not path.is_file():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return CaptionEditState.model_validate(data)

    def save(self, path: Path, state: CaptionEditState) -> Path:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(state.model_dump_json(indent=2), encoding="utf-8")
        return path
