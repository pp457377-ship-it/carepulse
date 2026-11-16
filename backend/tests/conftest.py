import os

os.environ["DATABASE_URL"] = "sqlite:///./test_carepulse.db"
os.environ["JWT_SECRET_KEY"] = "test-secret"
os.environ["GEMINI_API_KEY"] = ""  # no key → ai_source "unavailable", no network

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app

DB = os.path.join(os.path.dirname(__file__), "..", "test_carepulse.db")


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture()
def client():
    return TestClient(app)


def register(client, email="user@test.dev", password="password123", name="Test User"):
    r = client.post("/api/auth/register",
                    json={"full_name": name, "email": email, "password": password})
    assert r.status_code == 201, r.text
    return r.json()


def auth_headers(client, email="user@test.dev"):
    tokens = register(client, email=email)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


VALID = {
    "full_name": "Jane Example",
    "date_of_birth": "12/05/1990",
    "email": "jane@example.com",
    "glucose": 95,
    "haemoglobin": 13.4,
    "cholesterol": 180,
}


def add_patient(client, headers, **over):
    payload = VALID | over
    r = client.post("/api/patients", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()
