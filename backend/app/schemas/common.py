from enum import StrEnum


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ClipStatus(StrEnum):
    PENDING = "pending"
    RENDERING = "rendering"
    READY = "ready"
    FAILED = "failed"


class BundleProfile(StrEnum):
    FULL = "full"
    LITE = "lite"


class Resolution(StrEnum):
    UHD = "2160x3840"
    HD = "1080x1920"
    SD = "720x1280"


RESOLUTION_PIXELS: dict["Resolution", int] = {
    Resolution.UHD: 2160 * 3840,
    Resolution.HD: 1080 * 1920,
    Resolution.SD: 720 * 1280,
}


def available_resolutions(source_width: int, source_height: int) -> list[Resolution]:
    source_pixels = source_width * source_height
    ordered = [Resolution.UHD, Resolution.HD, Resolution.SD]
    return [res for res in ordered if RESOLUTION_PIXELS[res] <= source_pixels]


class CaptionStyleName(StrEnum):
    CLASSIC = "classic"
    PODCAST = "podcast"
    REELS = "reels"
    MINIMAL = "minimal"
