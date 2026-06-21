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
    HD = "1080x1920"
    SD = "720x1280"


class CaptionStyleName(StrEnum):
    CLASSIC = "classic"
    PODCAST = "podcast"
    REELS = "reels"
    MINIMAL = "minimal"
