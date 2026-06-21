from collections.abc import Generator

from app.config import Settings, get_settings
from app.db.repository import create_db_engine
from sqlmodel import Session

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_db_engine(get_settings())
    return _engine


def get_session() -> Generator[Session, None, None]:
    with Session(get_engine()) as session:
        yield session


def init_db(settings: Settings | None = None) -> None:
    global _engine
    _engine = create_db_engine(settings or get_settings())
