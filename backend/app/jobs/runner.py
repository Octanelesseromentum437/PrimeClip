import asyncio
import logging
from datetime import UTC, datetime
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
from app.schemas.common import AspectRatio, CaptionStyleName, JobStatus
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
        caption_style: CaptionStyleName | None = None,
        words_per_screen: int | None = None,
        aspect_ratio: AspectRatio | None = None,
    ) -> None:
        task = asyncio.create_task(
            self._run_job(
                job_id,
                video_id,
                provider_config,
                num_clips,
                language,
                caption_style or CaptionStyleName.REELS,
                words_per_screen,
                aspect_ratio or AspectRatio.VERTICAL,
            )
        )
        self._running[job_id] = task
        task.add_done_callback(lambda _: self._running.pop(job_id, None))

    def cancel(self, job_id: str, session: Session) -> bool:
        job_repo = JobRepository(session)
        job = job_repo.get(job_id)
        if not job:
            return False
        if job.status not in (JobStatus.QUEUED.value, JobStatus.RUNNING.value):
            return False

        job.status = JobStatus.CANCELLED.value
        job.finished_at = datetime.now(UTC)
        job_repo.update(job)

        task = self._running.get(job_id)
        if task and not task.done():
            task.cancel()
        self.ffmpeg.kill_all()
        return True

    async def _run_job(
        self,
        job_id: str,
        video_id: str,
        provider_config: ProviderConfig,
        num_clips: int,
        language: str | None,
        caption_style: CaptionStyleName,
        words_per_screen: int | None,
        aspect_ratio: AspectRatio,
    ) -> None:

        with Session(get_engine()) as session:
            job_repo = JobRepository(session)
            video_repo = VideoRepository(session)
            job = job_repo.get(job_id)
            video = video_repo.get(video_id)
            if not job or not video:
                return
            if job.status == JobStatus.CANCELLED.value:
                return

            ctx = PipelineContext(
                video_id=video_id,
                video_path=Path(video.source_path),
                duration_sec=video.duration_sec,
                language=language or video.language,
                provider_config=provider_config,
                num_clips=num_clips,
                caption_style=caption_style,
                words_per_screen=words_per_screen,
                aspect_ratio=aspect_ratio,
            )
            try:
                await self.pipeline.run(ctx, job, session)
            except asyncio.CancelledError:
                with Session(get_engine()) as cancel_session:
                    cancel_repo = JobRepository(cancel_session)
                    cancelled_job = cancel_repo.get(job_id)
                    if cancelled_job and cancelled_job.status not in (
                        JobStatus.CANCELLED.value,
                        JobStatus.COMPLETED.value,
                        JobStatus.FAILED.value,
                    ):
                        cancelled_job.status = JobStatus.CANCELLED.value
                        cancelled_job.finished_at = datetime.now(UTC)
                        cancel_repo.update(cancelled_job)
                raise


_runner: JobRunner | None = None


def get_job_runner() -> JobRunner:
    global _runner
    if _runner is None:
        _runner = JobRunner()
    return _runner
