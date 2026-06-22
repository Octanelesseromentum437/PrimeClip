from enum import StrEnum


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ClipStatus(StrEnum):
    PENDING = "pending"
    RENDERING = "rendering"
    READY = "ready"
    FAILED = "failed"


class BundleProfile(StrEnum):
    FULL = "full"
    LITE = "lite"


class AspectRatio(StrEnum):
    VERTICAL = "9:16"
    HORIZONTAL = "16:9"


class Resolution(StrEnum):
    UHD = "uhd"
    HD = "hd"
    SD = "sd"


RESOLUTION_DIMENSIONS: dict[tuple[AspectRatio, Resolution], tuple[int, int]] = {
    (AspectRatio.VERTICAL, Resolution.UHD): (2160, 3840),
    (AspectRatio.VERTICAL, Resolution.HD): (1080, 1920),
    (AspectRatio.VERTICAL, Resolution.SD): (720, 1280),
    (AspectRatio.HORIZONTAL, Resolution.UHD): (3840, 2160),
    (AspectRatio.HORIZONTAL, Resolution.HD): (1920, 1080),
    (AspectRatio.HORIZONTAL, Resolution.SD): (1280, 720),
}

# Legacy display labels for API responses.
RESOLUTION_LABELS: dict[tuple[AspectRatio, Resolution], str] = {
    (AspectRatio.VERTICAL, Resolution.UHD): "2160x3840",
    (AspectRatio.VERTICAL, Resolution.HD): "1080x1920",
    (AspectRatio.VERTICAL, Resolution.SD): "720x1280",
    (AspectRatio.HORIZONTAL, Resolution.UHD): "3840x2160",
    (AspectRatio.HORIZONTAL, Resolution.HD): "1920x1080",
    (AspectRatio.HORIZONTAL, Resolution.SD): "1280x720",
}


def output_dimensions(aspect_ratio: AspectRatio, resolution: Resolution) -> tuple[int, int]:
    return RESOLUTION_DIMENSIONS[(aspect_ratio, resolution)]


def resolution_label(aspect_ratio: AspectRatio, resolution: Resolution) -> str:
    return RESOLUTION_LABELS[(aspect_ratio, resolution)]


def parse_resolution_label(label: str, aspect_ratio: AspectRatio) -> Resolution:
    for res in Resolution:
        if RESOLUTION_LABELS[(aspect_ratio, res)] == label:
            return res
    return Resolution.HD


RESOLUTION_PIXELS: dict[Resolution, int] = {
    Resolution.UHD: 2160 * 3840,
    Resolution.HD: 1080 * 1920,
    Resolution.SD: 720 * 1280,
}


def available_resolutions(source_width: int, source_height: int) -> list[Resolution]:
    source_pixels = source_width * source_height
    ordered = [Resolution.UHD, Resolution.HD, Resolution.SD]
    return [res for res in ordered if RESOLUTION_PIXELS[res] <= source_pixels]


def available_resolution_labels(
    source_width: int, source_height: int, aspect_ratio: AspectRatio
) -> list[str]:
    return [
        resolution_label(aspect_ratio, res)
        for res in available_resolutions(source_width, source_height)
    ]


class CaptionStyleName(StrEnum):
    CLASSIC = "classic"
    PODCAST = "podcast"
    REELS = "reels"
    MINIMAL = "minimal"
