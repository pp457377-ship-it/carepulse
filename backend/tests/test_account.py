from conftest import add_patient, auth_headers


def test_update_profile_name(client):
    h = auth_headers(client)
    r = client.patch("/api/auth/me", json={"full_name": "Dr Renamed"}, headers=h)
    assert r.status_code == 200 and r.json()["full_name"] == "Dr Renamed"
    assert client.get("/api/auth/me", headers=h).json()["full_name"] == "Dr Renamed"
    actions = [a["action"] for a in client.get("/api/audit", headers=h).json()]
    assert "user.profile_updated" in actions


def test_change_password_requires_current(client):
    h = auth_headers(client)
    r = client.post("/api/auth/change-password",
                    json={"current_password": "wrong", "new_password": "newpassword123"}, headers=h)
    assert r.status_code == 400
    r = client.post("/api/auth/change-password",
                    json={"current_password": "password123", "new_password": "newpassword123"}, headers=h)
    assert r.status_code == 204
    assert client.post("/api/auth/login", json={"email": "user@test.dev", "password": "password123"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "user@test.dev", "password": "newpassword123"}).status_code == 200


def test_system_status_reflects_live_state(client):
    h = auth_headers(client)
    add_patient(client, h)
    r = client.get("/api/system/status", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["database"]["ok"] is True and body["database"]["dialect"] == "sqlite"
    assert body["ai"]["active_engine"] == "none"
    assert body["counts"]["patients"] == 1 and body["counts"]["assessments"] == 1
    assert client.get("/api/system/status").status_code == 401


def test_health_reports_database_and_security_headers(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["database"] == "sqlite"
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert r.headers["Cache-Control"] == "no-store"
