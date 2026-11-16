from conftest import VALID, add_patient, auth_headers


def test_create_returns_remarks_and_risk(client):
    headers = auth_headers(client)
    p = add_patient(client, headers)
    assert p["remarks"]
    assert p["risk_level"] in ("low", "moderate", "high")
    assert p["ai_source"] == "unavailable"
    assert p["health_score"] == 100  # all-normal labs


def test_list_pagination(client):
    headers = auth_headers(client)
    for i in range(12):
        add_patient(client, headers, email=f"p{i}@ex.com",
                    full_name=f"Person {chr(65 + i)}")
    r = client.get("/api/patients?page=2&page_size=5", headers=headers)
    body = r.json()
    assert body["total"] == 12
    assert len(body["items"]) == 5
    assert body["page"] == 2


def test_search_and_filter(client):
    headers = auth_headers(client)
    add_patient(client, headers, full_name="Alice Adams", email="alice@ex.com",
                glucose=250, cholesterol=320)
    add_patient(client, headers, full_name="Bob Brown", email="bob@ex.com",
                glucose=90)
    r = client.get("/api/patients?q=alice", headers=headers)
    assert r.json()["total"] == 1
    r = client.get("/api/patients?risk=high", headers=headers)
    assert r.json()["items"][0]["full_name"] == "Alice Adams"


def test_update_reruns_ai_when_labs_change(client):
    headers = auth_headers(client)
    p = add_patient(client, headers)
    old = p["remarks"]
    r = client.put(f"/api/patients/{p['id']}",
                   json={"glucose": 260.0, "cholesterol": 320.0}, headers=headers)
    assert r.status_code == 200
    assert r.json()["risk_level"] == "high"
    assert r.json()["health_score"] < 100


def test_email_only_update_keeps_remarks(client):
    headers = auth_headers(client)
    p = add_patient(client, headers)
    r = client.put(f"/api/patients/{p['id']}",
                   json={"email": "jane2@example.com"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["remarks"] == p["remarks"]
    assert r.json()["email"] == "jane2@example.com"


def test_delete(client):
    headers = auth_headers(client)
    p = add_patient(client, headers)
    r = client.delete(f"/api/patients/{p['id']}", headers=headers)
    assert r.status_code == 204
    r = client.get(f"/api/patients/{p['id']}", headers=headers)
    assert r.status_code == 404


def test_other_users_patient_invisible(client):
    h1 = auth_headers(client, "one@t.dev")
    h2 = auth_headers(client, "two@t.dev")
    p = add_patient(client, h1)
    assert client.get(f"/api/patients/{p['id']}", headers=h2).status_code == 404
    assert client.put(f"/api/patients/{p['id']}", json={"glucose": 99},
                      headers=h2).status_code == 404
    assert client.delete(f"/api/patients/{p['id']}", headers=h2).status_code == 404


def test_duplicate_email_conflict(client):
    headers = auth_headers(client)
    add_patient(client, headers)
    r = client.post("/api/patients", json=VALID, headers=headers)
    assert r.status_code == 409


def test_regenerate_remarks(client):
    headers = auth_headers(client)
    p = add_patient(client, headers)
    r = client.post(f"/api/patients/{p['id']}/regenerate-remarks",
                    headers=headers)
    assert r.status_code == 200
    assert r.json()["remarks"]


def test_sort_by_health_score(client):
    headers = auth_headers(client)
    add_patient(client, headers, email="a@ex.com", glucose=250)   # low score
    add_patient(client, headers, email="b@ex.com", glucose=90)    # high score
    r = client.get("/api/patients?sort=health_score:asc", headers=headers)
    scores = [i["health_score"] for i in r.json()["items"]]
    assert scores == sorted(scores)
