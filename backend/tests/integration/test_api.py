import pytest
from app.config import Settings, get_settings
from app.db.session import init_db
from app.main import create_app
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("OUTPUT_DIR", str(tmp_path / "outputs"))
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    get_settings.cache_clear()
    settings = Settings()
    init_db(settings)
    app = create_app()
    with TestClient(app) as c:
        yield c
    get_settings.cache_clear()


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "dependencies" in data


def test_list_providers(client):
    resp = client.get("/api/providers")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["providers"]) >= 4
