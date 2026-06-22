#!/usr/bin/env python3
"""Generate app icon shape variants (square, rounded, circle) from a source PNG."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src-tauri" / "icons" / "source.png"
VARIANTS_DIR = ROOT / "src-tauri" / "icons" / "variants"
PUBLIC_DIR = ROOT / "public" / "icons"

# ~22% corner radius matches macOS squircle appearance when pre-masked.
ROUNDED_RADIUS_RATIO = 0.2237


def load_source() -> Image.Image:
    if not SOURCE.exists():
        fallback = ROOT / "src-tauri" / "icons" / "icon.png"
        if fallback.exists():
            shutil.copy2(fallback, SOURCE)
        else:
            raise FileNotFoundError(f"No source icon at {SOURCE}")
    img = Image.open(SOURCE).convert("RGBA")
    if img.size[0] != img.size[1]:
        side = min(img.size)
        left = (img.size[0] - side) // 2
        top = (img.size[1] - side) // 2
        img = img.crop((left, top, left + side, top + side))
    return img


def mask_rounded(size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    radius = int(size * ROUNDED_RADIUS_RATIO)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def mask_circle(size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    return mask


def apply_mask(img: Image.Image, mask: Image.Image) -> Image.Image:
    out = img.copy()
    out.putalpha(mask)
    return out


def write_variant(name: str, img: Image.Image) -> None:
    VARIANTS_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    path = VARIANTS_DIR / f"{name}.png"
    img.save(path, optimize=True)
    shutil.copy2(path, PUBLIC_DIR / f"{name}.png")
    print(f"  wrote {path}")


def main() -> int:
    img = load_source()
    size = img.size[0]
    print(f"Source: {SOURCE} ({size}x{size})")

    write_variant("square", img.copy())
    write_variant("rounded", apply_mask(img, mask_rounded(size)))
    write_variant("circle", apply_mask(img, mask_circle(size)))

    default = VARIANTS_DIR / "rounded.png"
    main_icon = ROOT / "src-tauri" / "icons" / "icon.png"
    shutil.copy2(default, main_icon)
    print(f"  default icon -> {main_icon}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
