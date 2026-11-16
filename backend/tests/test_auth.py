from conftest import VALID, auth_headers, register


def test_register_and_login(client):
    register(client)
    r = client.post("/api/auth/login",
                    json={"email": "user@test.dev", "password": "password123"})
    assert r.status_code == 200
    assert r.json()["access_token"]


def test_duplicate_register_rejected(client):
    register(client)
    r = client.post("/api/auth/register", json={
        "full_name": "Other User", "email": "user@test.dev",
        "password": "password123"})
    assert r.status_code == 409


def test_wrong_password_rejected(client):
    register(client)
    r = client.post("/api/auth/login",
                    json={"email": "user@test.dev", "password": "wrongpass1"})
    assert r.status_code == 401


def test_short_password_rejected(client):
    r = client.post("/api/auth/register", json={
        "full_name": "User", "email": "u2@test.dev", "password": "short"})
    assert r.status_code == 422


def test_protected_route_requires_token(client):
    r = client.get("/api/patients")
    assert r.status_code == 401


def test_refresh_token_flow(client):
    tokens = register(client)
    r = client.post("/api/auth/refresh",
                    json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200
    assert r.json()["access_token"] != ""


def test_access_token_cannot_refresh(client):
    tokens = register(client)
    r = client.post("/api/auth/refresh",
                    json={"refresh_token": tokens["access_token"]})
    assert r.status_code == 401


def test_rate_limit_after_five_failed_logins(client):
    register(client)
    for i in range(5):
        client.post("/api/auth/login",
                    json={"email": "user@test.dev", "password": "nope12345"})
    r = client.post("/api/auth/login",
                    json={"email": "user@test.dev", "password": "password123"})
    assert r.status_code == 429


def test_users_isolated(client):
    h1 = auth_headers(client, "a@test.dev")
    h2 = auth_headers(client, "b@test.dev")
    client.post("/api/patients", json=VALID, headers=h1)
    r = client.get("/api/patients", headers=h2)
    assert r.json()["total"] == 0


def test_me_endpoint(client):
    headers = auth_headers(client)
    r = client.get("/api/auth/me", headers=headers)
    assert r.json()["email"] == "user@test.dev"
