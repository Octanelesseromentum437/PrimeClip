from unittest.mock import MagicMock

import pytest
from app.config import Settings, get_settings
from app.db.models import Job, Video
from app.db.repository import JobRepository, VideoRepository
from app.db.session import create_db_engine
from app.pipelines.clip_pipeline import ClipGenerationPipeline, JobCancelledError
from app.pipelines.context import PipelineContext
from app.schemas.common import JobStatus
from app.schemas.provider import ProviderConfig, ProviderKind
from sqlmodel import Session


@pytest.mark.asyncio
async def test_pipeline_exits_when_job_cancelled(tmp_path, monkeypatch):
    monkeypatch.setenv("OUTPUT_DIR", str(tmp_path / "outputs"))
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    get_settings.cache_clear()
    settings = Settings()

    file_store = MagicMock()
    file_store.artifact_dir.return_value = tmp_path / "artifacts"
    ffmpeg = MagicMock()

    pipeline = ClipGenerationPipeline(
        settings=settings,
        file_store=file_store,
        ffmpeg=ffmpeg,
        transcription=MagicMock(),
        scene_detection=MagicMock(),
        registry=MagicMock(),
        face_tracking=MagicMock(),
        vertical_crop=MagicMock(),
        captions=MagicMock(),
        motion=MagicMock(),
        render=MagicMock(),
    )
    pipeline.audio.extract = MagicMock(return_value=tmp_path / "audio.wav")

    video_path = tmp_path / "video.mp4"
    video_path.write_bytes(b"fake")
    engine = create_db_engine(settings)

    with Session(engine) as session:
        video = Video(id="v1", filename="test.mp4", source_path=str(video_path), duration_sec=120)
        VideoRepository(session).create(video)
        job = Job(
            id="j1",
            video_id="v1",
            provider_kind="ollama",
            model="qwen3",
            num_clips=1,
            status=JobStatus.CANCELLED.value,
        )
        JobRepository(session).create(job)

        ctx = PipelineContext(
            video_id="v1",
            video_path=video_path,
            duration_sec=120,
            provider_config=ProviderConfig(kind=ProviderKind.OLLAMA, model="qwen3"),
            num_clips=1,
        )

        result = await pipeline.run(ctx, job, session)
        assert result.status == JobStatus.CANCELLED.value

    get_settings.cache_clear()


def test_check_cancelled_raises():
    pipeline = ClipGenerationPipeline(
        settings=MagicMock(),
        file_store=MagicMock(),
        ffmpeg=MagicMock(),
        transcription=MagicMock(),
        scene_detection=MagicMock(),
        registry=MagicMock(),
        face_tracking=MagicMock(),
        vertical_crop=MagicMock(),
        captions=MagicMock(),
        motion=MagicMock(),
        render=MagicMock(),
    )
    session = MagicMock()
    job = Job(
        id="j1",
        video_id="v1",
        provider_kind="ollama",
        model="qwen3",
        num_clips=1,
        status=JobStatus.CANCELLED.value,
    )

    with pytest.raises(JobCancelledError):
        pipeline._check_cancelled(job, session)

    session.refresh.assert_called_once_with(job)
