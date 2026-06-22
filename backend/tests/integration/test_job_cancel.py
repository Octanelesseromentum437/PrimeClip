from app.config import Settings, get_settings
from app.db.models import Job, Video
from app.db.repository import JobRepository, VideoRepository
from app.db.session import init_db
from app.schemas.common import JobStatus
from sqlmodel import Session


def test_cancel_running_job(client, tmp_path, monkeypatch):
    settings = Settings()
    engine = init_db(settings)

    with Session(engine) as session:
        video = Video(
            id="v-cancel",
            filename="test.mp4",
            source_path="/tmp/test.mp4",
            duration_sec=60,
        )
        VideoRepository(session).create(video)
        job = Job(
            id="j-cancel",
            video_id=video.id,
            provider_kind="ollama",
            model="qwen3",
            num_clips=1,
            status=JobStatus.RUNNING.value,
            progress_pct=25,
            current_stage="transcribe",
        )
        JobRepository(session).create(job)
        job_id = job.id

    resp = client.post(f"/api/jobs/{job_id}/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == JobStatus.CANCELLED.value

    with Session(engine) as session:
        stored = JobRepository(session).get(job_id)
        assert stored is not None
        assert stored.status == JobStatus.CANCELLED.value
        assert stored.finished_at is not None

    get_settings.cache_clear()


def test_cancel_completed_job_returns_409(client, tmp_path, monkeypatch):
    settings = Settings()
    engine = init_db(settings)

    with Session(engine) as session:
        video = Video(
            id="v-cancel",
            filename="test.mp4",
            source_path="/tmp/test.mp4",
            duration_sec=60,
        )
        VideoRepository(session).create(video)
        job = Job(
            id="j-cancel",
            video_id=video.id,
            provider_kind="ollama",
            model="qwen3",
            num_clips=1,
            status=JobStatus.COMPLETED.value,
        )
        JobRepository(session).create(job)
        job_id = job.id

    resp = client.post(f"/api/jobs/{job_id}/cancel")
    assert resp.status_code == 409

    get_settings.cache_clear()
