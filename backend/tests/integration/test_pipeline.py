from unittest.mock import AsyncMock, MagicMock

import pytest
from app.config import Settings, get_settings
from app.db.models import Job, Video
from app.db.repository import JobRepository, VideoRepository
from app.db.session import create_db_engine
from app.pipelines.clip_pipeline import ClipGenerationPipeline
from app.pipelines.context import PipelineContext
from app.schemas.clip import ClipCandidate
from app.schemas.provider import ProviderConfig, ProviderKind
from app.schemas.transcript import TranscriptSegment
from sqlmodel import Session


@pytest.mark.asyncio
async def test_pipeline_smoke(tmp_path, monkeypatch):
    monkeypatch.setenv("OUTPUT_DIR", str(tmp_path / "outputs"))
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    get_settings.cache_clear()
    settings = Settings()

    mock_registry = MagicMock()
    mock_provider = AsyncMock()
    mock_provider.generate_clip_candidates.return_value = [
        ClipCandidate(title="Test Clip", start=0, end=45, score=8.0, reason="test")
    ]
    mock_registry.create.return_value = mock_provider

    file_store = MagicMock()
    file_store.artifact_dir.return_value = tmp_path / "artifacts"
    file_store.clips_output_dir.return_value = tmp_path / "clips"
    file_store.write_json_artifact = MagicMock()

    ffmpeg = MagicMock()
    ffmpeg.probe_dimensions.return_value = (1920, 1080)

    pipeline = ClipGenerationPipeline(
        settings=settings,
        file_store=file_store,
        ffmpeg=ffmpeg,
        transcription=MagicMock(
            transcribe=MagicMock(
                return_value=[TranscriptSegment(start=0, end=10, text="hello", confidence=0.9)]
            )
        ),
        scene_detection=MagicMock(detect=MagicMock(return_value=[])),
        registry=mock_registry,
        face_tracking=MagicMock(track=MagicMock(return_value=[])),
        vertical_crop=MagicMock(
            compute_crop_path=MagicMock(return_value=MagicMock(keyframes=[])),
            slice_for_clip=MagicMock(return_value=MagicMock(keyframes=[])),
        ),
        captions=MagicMock(generate=MagicMock(return_value=MagicMock(ass=tmp_path / "c.ass"))),
        motion=MagicMock(plan=MagicMock(return_value=MagicMock(effects=[]))),
        render=MagicMock(render=MagicMock(return_value=MagicMock(output_path=tmp_path / "o.mp4"))),
    )
    pipeline.audio.extract = MagicMock(return_value=tmp_path / "audio.wav")

    video_path = tmp_path / "video.mp4"
    video_path.write_bytes(b"fake")
    engine = create_db_engine(settings)

    with Session(engine) as session:
        video = Video(id="v1", filename="test.mp4", source_path=str(video_path), duration_sec=120)
        VideoRepository(session).create(video)
        job = Job(id="j1", video_id="v1", provider_kind="ollama", model="qwen3", num_clips=1)
        JobRepository(session).create(job)

        ctx = PipelineContext(
            video_id="v1",
            video_path=video_path,
            duration_sec=120,
            provider_config=ProviderConfig(kind=ProviderKind.OLLAMA, model="qwen3"),
            num_clips=1,
        )

        result = await pipeline.run(ctx, job, session)
        assert result.status == "completed"
        assert result.progress_pct == 100

    get_settings.cache_clear()
