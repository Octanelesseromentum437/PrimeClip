from app.config import Settings
from app.db.models import AppPreferences, Clip, Job, Video
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


def create_db_engine(settings: Settings):
    db_path = settings.database_url.replace("sqlite:///", "")
    if db_path.startswith("./"):
        db_path = settings.output_dir / db_path[2:]
        url = f"sqlite:///{db_path}"
    else:
        url = settings.database_url
    engine = create_engine(url, connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return engine
