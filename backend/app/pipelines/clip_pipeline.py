import asyncio
import logging
from collections.abc import Callable
from datetime import UTC, datetime

from app.config import Settings
from app.db.models import Clip, Job
from app.db.repository import ClipRepository, JobRepository
from app.infra.ffmpeg import FFmpegService
from app.infra.storage import FileStore
from app.pipelines.context import PipelineContext
from app.providers.registry import ProviderRegistry
from app.schemas.clip import ClipSelectionRequest
from app.schemas.common import CaptionStyleName, ClipStatus, JobStatus
from app.services.audio.extract import AudioExtractService
from app.services.captions.generator import CaptionService
from app.services.face_tracking.mediapipe_tracker import FaceTrackingService
from app.services.motion.planner import MotionService
from app.services.render.ffmpeg_renderer import RenderService
from app.services.scene_detection.histogram import SceneDetectionService
from app.services.transcription.whisper import TranscriptionService
from app.services.vertical_crop.dynamic_crop import VerticalCropService
from sqlmodel import Session

logger = logging.getLogger(__name__)


class ClipGenerationPipeline:
    STAGES = [
        "extract_audio",
        "transcribe",
        "detect_scenes",
        "select_clips",
        "track_faces",
        "render_clips",
    ]

    def __init__(
        self,
        settings: Settings,
        file_store: FileStore,
        ffmpeg: FFmpegService,
        transcription: TranscriptionService,
        scene_detection: SceneDetectionService,
        registry: ProviderRegistry,
        face_tracking: FaceTrackingService,
        vertical_crop: VerticalCropService,
        captions: CaptionService,
        motion: MotionService,
        render: RenderService,
    ) -> None:
        self.settings = settings
        self.file_store = file_store
        self.audio = AudioExtractService(ffmpeg)
        self.transcription = transcription
        self.scene_detection = scene_detection
        self.registry = registry
        self.face_tracking = face_tracking
        self.vertical_crop = vertical_crop
        self.captions = captions
        self.motion = motion
        self.render = render
        self.ffmpeg = ffmpeg

    async def run(
        self,
        ctx: PipelineContext,
        job: Job,
        session: Session,
        progress_callback: Callable[[Job], None] | None = None,
    ) -> Job:
        job_repo = JobRepository(session)
        clip_repo = ClipRepository(session)

        def update(stage: str, pct: int) -> None:
            job.current_stage = stage
            job.progress_pct = pct
            job.status = JobStatus.RUNNING.value
            job_repo.update(job)
            if progress_callback:
                progress_callback(job)

        try:
            job.started_at = datetime.now(UTC)
            job_repo.update(job)

            # Stage 1: Extract audio
            update("extract_audio", 5)
            audio_path = self.file_store.artifact_dir(ctx.video_id) / "audio.wav"
            await asyncio.to_thread(self.audio.extract, ctx.video_path, audio_path)
            ctx.audio_path = audio_path

            # Stage 2: Transcribe
            update("transcribe", 15)
            lang = None
            if ctx.language in ("en", "pt"):
                lang = ctx.language  # type: ignore[assignment]
            ctx.transcript = await asyncio.to_thread(
                self.transcription.transcribe, audio_path, language=lang
            )
            self.file_store.write_json_artifact(
                ctx.video_id,
                "transcript.json",
                [s.model_dump() for s in ctx.transcript],
            )

            # Stage 3: Scene detection
            update("detect_scenes", 25)
            ctx.scenes = await asyncio.to_thread(
                self.scene_detection.detect,
                ctx.video_path,
                threshold=self.settings.scene_threshold,
                min_scene_len_sec=self.settings.scene_min_len_sec,
            )
            self.file_store.write_json_artifact(
                ctx.video_id,
                "scenes.json",
                [s.model_dump() for s in ctx.scenes],
            )

            # Stage 4: LLM clip selection
            update("select_clips", 40)
            if ctx.provider_config is None:
                raise ValueError("Provider config required")
            provider = self.registry.create(ctx.provider_config)
            request = ClipSelectionRequest(
                transcript=ctx.transcript,
                scenes=ctx.scenes,
                duration_sec=ctx.duration_sec,
                language=ctx.language or "en",
                num_clips=ctx.num_clips,
            )
            ctx.clip_candidates = await provider.generate_clip_candidates(
                request, ctx.provider_config
            )
            self.file_store.write_json_artifact(
                ctx.video_id,
                "clip_candidates.json",
                [c.model_dump() for c in ctx.clip_candidates],
            )

            # Stage 5: Face tracking
            update("track_faces", 55)
            ctx.face_frames = await asyncio.to_thread(
                self.face_tracking.track, ctx.video_path
            )
            ctx.source_width, ctx.source_height = await asyncio.to_thread(
                self.ffmpeg.probe_dimensions, ctx.video_path
            )
            self.file_store.write_json_artifact(
                ctx.video_id,
                "face_tracks.json",
                [f.model_dump() for f in ctx.face_frames],
            )

            # Stage 6: Render clips
            full_crop = await asyncio.to_thread(
                self.vertical_crop.compute_crop_path,
                ctx.face_frames,
                (ctx.source_width, ctx.source_height),
            )

            db_clips: list[Clip] = []
            for idx, candidate in enumerate(ctx.clip_candidates):
                pct = 55 + int((idx + 1) / max(len(ctx.clip_candidates), 1) * 40)
                update(f"render_clips:{idx + 1}", pct)

                clip_record = Clip(
                    job_id=job.id,
                    video_id=ctx.video_id,
                    index=idx + 1,
                    title=candidate.title,
                    start_sec=candidate.start,
                    end_sec=candidate.end,
                    score=candidate.score,
                    reason=candidate.reason,
                    status=ClipStatus.RENDERING.value,
                )
                db_clips.append(clip_record)
            clip_repo.create_many(db_clips)

            output_dir = self.file_store.clips_output_dir(ctx.video_id)
            for db_clip, candidate in zip(db_clips, ctx.clip_candidates, strict=True):
                try:
                    clip_crop = self.vertical_crop.slice_for_clip(
                        full_crop, candidate.start, candidate.end
                    )
                    artifact = self.file_store.artifact_dir(ctx.video_id)
                    cap_dir = artifact / f"clip_{db_clip.index:02d}"
                    caption_files = self.captions.generate(
                        ctx.transcript,
                        (candidate.start, candidate.end),
                        CaptionStyleName.REELS,
                        cap_dir,
                    )
                    motion_plan = self.motion.plan(candidate, ctx.transcript)
                    output_path = output_dir / f"clip_{db_clip.index:02d}.mp4"

                    from app.schemas.render import RenderRequest

                    await asyncio.to_thread(
                        self.render.render,
                        RenderRequest(
                            source_video=ctx.video_path,
                            clip=candidate,
                            crop_path=clip_crop,
                            caption_ass=caption_files.ass,
                            motion_plan=motion_plan,
                            output_path=output_path,
                        ),
                    )
                    db_clip.output_path = str(output_path)
                    db_clip.status = ClipStatus.READY.value
                except Exception as exc:
                    logger.exception("Failed to render clip %s", db_clip.index)
                    db_clip.status = ClipStatus.FAILED.value
                    db_clip.reason = f"{db_clip.reason} | render error: {exc}"
                clip_repo.update(db_clip)

            job.status = JobStatus.COMPLETED.value
            job.progress_pct = 100
            job.current_stage = "done"
            job.finished_at = datetime.now(UTC)
            job_repo.update(job)
            return job

        except Exception as exc:
            logger.exception("Pipeline failed for job %s", job.id)
            job.status = JobStatus.FAILED.value
            job.error_message = str(exc)
            job.finished_at = datetime.now(UTC)
            job_repo.update(job)
            return job
