from __future__ import annotations

import logging
import platform
import subprocess
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_FONT_DIRS: dict[str, list[Path]] = {
    "Darwin": [
        Path("/System/Library/Fonts"),
        Path("/Library/Fonts"),
        Path.home() / "Library/Fonts",
    ],
    "Linux": [
        Path("/usr/share/fonts"),
        Path("/usr/local/share/fonts"),
        Path.home() / ".local/share/fonts",
        Path.home() / ".fonts",
    ],
    "Windows": [
        Path("C:/Windows/Fonts"),
    ],
}


def _family_from_font_file(path: Path) -> str | None:
    try:
        from fontTools.ttLib import TTFont  # type: ignore[import-untyped]
    except ImportError:
        return path.stem.replace("-", " ").replace("_", " ")

    try:
        font = TTFont(path, fontNumber=0, lazy=True)
        name_table = font["name"]
        for name_id in (16, 1, 4):
            name = name_table.getBestName(name_id)
            if name:
                return str(name)
    except Exception:
        logger.debug("Could not read font family from %s", path, exc_info=True)
    return path.stem.replace("-", " ").replace("_", " ")


def _families_from_fc_list() -> list[str]:
    try:
        result = subprocess.run(
            ["fc-list", ":", "family"],
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    if result.returncode != 0:
        return []

    families: set[str] = set()
    for line in result.stdout.splitlines():
        for part in line.split(","):
            family = part.strip()
            if family:
                families.add(family)
    return sorted(families)


def _families_from_dirs() -> list[str]:
    system = platform.system()
    dirs = _FONT_DIRS.get(system, [])
    families: set[str] = set()
    extensions = {".ttf", ".otf", ".ttc", ".otc"}

    for directory in dirs:
        if not directory.is_dir():
            continue
        for path in directory.rglob("*"):
            if path.suffix.lower() not in extensions:
                continue
            family = _family_from_font_file(path)
            if family:
                families.add(family)

    return sorted(families)


@lru_cache(maxsize=1)
def list_system_fonts() -> tuple[str, ...]:
    families = _families_from_fc_list()
    if not families:
        families = _families_from_dirs()

    # Always include common fallbacks used by caption presets.
    for fallback in ("Impact", "Arial", "Helvetica", "Georgia", "Verdana"):
        if fallback not in families:
            families.append(fallback)

    return tuple(sorted(set(families), key=str.lower))
