from app.config import Settings
from app.db.models import AppPreferences, Clip, ClipVariant, Job, Video
from sqlmodel import Session, SQLModel, create_engine, select


class VideoRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create(self, video: Video) -> Video:
        self.session.add(video)
        self.session.commit()
        self.session.refresh(video)
        return video

    def get(self, video_id: str) -> Video | None:
        return self.session.get(Video, video_id)

    def list_all(self) -> list[Video]:
        return list(self.session.exec(select(Video).order_by(Video.created_at.desc())).all())

    def update(self, video: Video) -> Video:
        self.session.add(video)
        self.session.commit()
        self.session.refresh(video)
        return video

    def delete(self, video_id: str) -> bool:
        video = self.get(video_id)
        if video is None:
            return False
        self.session.delete(video)
        self.session.commit()
        return True


class ClipVariantRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, clip_id: str, resolution: str) -> ClipVariant | None:
        stmt = select(ClipVariant).where(
            ClipVariant.clip_id == clip_id,
            ClipVariant.resolution == resolution,
        )
        return self.session.exec(stmt).first()

    def upsert(self, variant: ClipVariant) -> ClipVariant:
        existing = self.get(variant.clip_id, variant.resolution)
        if existing:
            existing.output_path = variant.output_path
            self.session.add(existing)
            self.session.commit()
            self.session.refresh(existing)
            return existing
        self.session.add(variant)
        self.session.commit()
        self.session.refresh(variant)
        return variant

    def list_for_clip(self, clip_id: str) -> list[ClipVariant]:
        stmt = select(ClipVariant).where(ClipVariant.clip_id == clip_id)
        return list(self.session.exec(stmt).all())

    def delete_for_clip(self, clip_id: str) -> None:
        for variant in self.list_for_clip(clip_id):
            self.session.delete(variant)
        self.session.commit()


class JobRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create(self, job: Job) -> Job:
        self.session.add(job)
        self.session.commit()
        self.session.refresh(job)
        return job

    def get(self, job_id: str) -> Job | None:
        return self.session.get(Job, job_id)

    def update(self, job: Job) -> Job:
        self.session.add(job)
        self.session.commit()
        self.session.refresh(job)
        return job

    def get_latest_for_video(self, video_id: str) -> Job | None:
        stmt = select(Job).where(Job.video_id == video_id).order_by(Job.started_at.desc())  # type: ignore[arg-type]
        return self.session.exec(stmt).first()

    def list_for_video(self, video_id: str) -> list[Job]:
        stmt = select(Job).where(Job.video_id == video_id).order_by(Job.started_at.desc())  # type: ignore[arg-type]
        return list(self.session.exec(stmt).all())

    def delete_for_video(self, video_id: str) -> None:
        for job in self.list_for_video(video_id):
            self.session.delete(job)
        self.session.commit()


class ClipRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create_many(self, clips: list[Clip]) -> list[Clip]:
        for clip in clips:
            self.session.add(clip)
        self.session.commit()
        for clip in clips:
            self.session.refresh(clip)
        return clips

    def list_for_video(self, video_id: str) -> list[Clip]:
        stmt = select(Clip).where(Clip.video_id == video_id).order_by(Clip.index)
        return list(self.session.exec(stmt).all())

    def count_for_video(self, video_id: str) -> int:
        return len(self.list_for_video(video_id))

    def delete_for_video(self, video_id: str) -> None:
        variant_repo = ClipVariantRepository(self.session)
        for clip in self.list_for_video(video_id):
            variant_repo.delete_for_clip(clip.id)
            self.session.delete(clip)
        self.session.commit()

    def get(self, clip_id: str) -> Clip | None:
        return self.session.get(Clip, clip_id)

    def update(self, clip: Clip) -> Clip:
        self.session.add(clip)
        self.session.commit()
        self.session.refresh(clip)
        return clip


class PreferencesRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_or_create(self) -> AppPreferences:
        prefs = self.session.get(AppPreferences, 1)
        if prefs is None:
            prefs = AppPreferences()
            self.session.add(prefs)
            self.session.commit()
            self.session.refresh(prefs)
        return prefs

    def update(self, prefs: AppPreferences) -> AppPreferences:
        self.session.add(prefs)
        self.session.commit()
        self.session.refresh(prefs)
        return prefs


def _migrate_sqlite(engine) -> None:
    import sqlalchemy as sa

    with engine.connect() as conn:
        rows = conn.execute(sa.text("PRAGMA table_info(video)")).fetchall()
        columns = {row[1] for row in rows}
        additions = {
            "source_width": "INTEGER",
            "source_height": "INTEGER",
            "source_url": "TEXT",
            "source_provider": "TEXT",
        }
        for name, col_type in additions.items():
            if name not in columns:
                conn.execute(sa.text(f"ALTER TABLE video ADD COLUMN {name} {col_type}"))

        clip_rows = conn.execute(sa.text("PRAGMA table_info(clip)")).fetchall()
        clip_columns = {row[1] for row in clip_rows}
        if "thumbnail_path" not in clip_columns:
            conn.execute(sa.text("ALTER TABLE clip ADD COLUMN thumbnail_path TEXT"))
        conn.commit()


def create_db_engine(settings: Settings):
    db_path = settings.database_url.replace("sqlite:///", "")
    if db_path.startswith("./"):
        db_path = settings.output_dir / db_path[2:]
        url = f"sqlite:///{db_path}"
    else:
        url = settings.database_url
    engine = create_engine(url, connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    if url.startswith("sqlite"):
        _migrate_sqlite(engine)
    return engine
