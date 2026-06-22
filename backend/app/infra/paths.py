from pathlib import Path

from app.config import Settings


def resolve_storage_path(path: str | Path, settings: Settings | None = None) -> Path:
    """Return an absolute path for a stored file, including legacy relative entries."""
    candidate = Path(path)
    if candidate.is_absolute():
        return candidate

    resolved = candidate.resolve()
    if resolved.exists():
        return resolved

    if settings is not None:
        alt = (settings.output_dir.resolve().parent / candidate).resolve()
        if alt.exists():
            return alt

    return resolved
