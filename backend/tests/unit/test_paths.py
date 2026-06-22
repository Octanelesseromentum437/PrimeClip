from pathlib import Path

from app.config import Settings
from app.infra.paths import resolve_storage_path


def test_resolve_storage_path_absolute(tmp_path: Path) -> None:
    file_path = tmp_path / "video.mp4"
    file_path.write_bytes(b"x")
    assert resolve_storage_path(file_path) == file_path.resolve()


def test_resolve_storage_path_relative_to_cwd(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    uploads = tmp_path / "outputs" / "uploads" / "vid"
    uploads.mkdir(parents=True)
    file_path = uploads / "source.mp4"
    file_path.write_bytes(b"x")

    resolved = resolve_storage_path(Path("outputs/uploads/vid/source.mp4"))
    assert resolved == file_path.resolve()


def test_resolve_storage_path_legacy_relative(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path / "backend")
    outputs = tmp_path / "outputs"
    uploads = outputs / "uploads" / "vid"
    uploads.mkdir(parents=True)
    file_path = uploads / "source.mp4"
    file_path.write_bytes(b"x")

    settings = Settings(output_dir=outputs)
    resolved = resolve_storage_path("outputs/uploads/vid/source.mp4", settings)
    assert resolved == file_path.resolve()
