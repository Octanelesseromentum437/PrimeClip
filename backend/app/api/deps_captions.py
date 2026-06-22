from app.config import get_settings
from app.infra.dependencies import DependencyResolver
from app.infra.ffmpeg import FFmpegService
from app.infra.storage import FileStore
from app.services.captions.generator import CaptionService
from app.services.captions.rerender import ClipRerenderService
from app.services.face_tracking.mediapipe_tracker import FaceTrackingService
from app.services.motion.planner import MotionService
from app.services.render.ffmpeg_renderer import RenderService
from app.services.vertical_crop.dynamic_crop import VerticalCropService


def get_clip_rerender_service() -> ClipRerenderService:
    settings = get_settings()
    resolver = DependencyResolver(settings)
    ffmpeg = FFmpegService(resolver)
    return ClipRerenderService(
        file_store=FileStore(settings),
        ffmpeg=ffmpeg,
        captions=CaptionService(),
        face_tracking=FaceTrackingService(),
        vertical_crop=VerticalCropService(),
        motion=MotionService(),
        render=RenderService(ffmpeg),
    )
