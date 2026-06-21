import asyncio
import logging
from pathlib import Path

from app.config import Settings, get_settings
from app.db.repository import JobRepository, VideoRepository
from app.db.session import get_engine
from app.infra.dependencies import DependencyResolver
from app.infra.ffmpeg import FFmpegService
from app.infra.storage import FileStore
from app.pipelines.clip_pipeline import ClipGenerationPipeline
from app.pipelines.context import PipelineContext
from app.providers.registry import ProviderRegistry
from app.schemas.provider import ProviderConfig
from app.services.captions.generator import CaptionService
from app.services.face_tracking.mediapipe_tracker import FaceTrackingService
from app.services.motion.planner import MotionService
from app.services.render.ffmpeg_renderer import RenderService
from app.services.scene_detection.histogram import SceneDetectionService
from app.services.transcription.whisper import TranscriptionService
from app.services.vertical_crop.dynamic_crop import VerticalCropService
from sqlmodel import Session

logger = logging.getLogger(__name__)


class JobRunner:
    _running: dict[str, asyncio.Task] = {}

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.resolver = DependencyResolver(self.settings)
        self.file_store = FileStore(self.settings)
        self.ffmpeg = FFmpegService(self.resolver)
        self.registry = ProviderRegistry(self.settings)
        self.pipeline = ClipGenerationPipeline(
            settings=self.settings,
            file_store=self.file_store,
            ffmpeg=self.ffmpeg,
            transcription=TranscriptionService(self.settings, self.resolver),
            scene_detection=SceneDetectionService(),
            registry=self.registry,
            face_tracking=FaceTrackingService(),
            vertical_crop=VerticalCropService(),
            captions=CaptionService(),
            motion=MotionService(),
            render=RenderService(self.ffmpeg),
        )

    def enqueue(
        self,
        job_id: str,
        video_id: str,
        provider_config: ProviderConfig,
        num_clips: int,
        language: str | None = None,
    ) -> None:
        task = asyncio.create_task(
            self._run_job(job_id, video_id, provider_config, num_clips, language)
        )
        self._running[job_id] = task
        task.add_done_callback(lambda _: self._running.pop(job_id, None))

    async def _run_job(
        self,
        job_id: str,
        video_id: str,
        provider_config: ProviderConfig,
        num_clips: int,
        language: str | None,
    ) -> None:
        with Session(get_engine()) as session:
            job_repo = JobRepository(session)
            video_repo = VideoRepository(session)
            job = job_repo.get(job_id)
            video = video_repo.get(video_id)
            if not job or not video:
                return

            ctx = PipelineContext(
                video_id=video_id,
                video_path=Path(video.source_path),
                duration_sec=video.duration_sec,
                language=language or video.language,
                provider_config=provider_config,
                num_clips=num_clips,
            )
            await self.pipeline.run(ctx, job, session)


_runner: JobRunner | None = None


def get_job_runner() -> JobRunner:
    global _runner
    if _runner is None:
        _runner = JobRunner()
    return _runner
