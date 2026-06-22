import pytest
from app.config import Settings, get_settings
from app.db.session import init_db
from app.main import create_app
from fastapi.testclient import TestClient


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
