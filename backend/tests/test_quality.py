from conftest import VALID, add_patient, auth_headers


def test_validation_rules_derived_from_validator(client):
    r = client.get("/api/validation/rules")
    assert r.status_code == 200
    rules = r.json()["rules"]
    fields = {x["field"] for x in rules}
    assert {"full_name", "email", "date_of_birth", "glucose", "haemoglobin", "cholesterol", "*"} <= fields
    glucose = next(x for x in rules if x["field"] == "glucose")
    assert glucose["min"] == 20.0 and glucose["max"] == 800.0 and glucose["unit"] == "mg/dL"


def test_dry_run_validate_does_not_save(client):
    h = auth_headers(client)
    r = client.post("/api/patients/validate", json=VALID | {"email": "bad"}, headers=h)
    assert r.json()["valid"] is False and r.json()["errors"]
    r = client.post("/api/patients/validate", json=VALID, headers=h)
    assert r.json()["valid"] is True
    assert client.get("/api/patients", headers=h).json()["total"] == 0


def test_dry_run_exclude_id_skips_own_record(client):
    h = auth_headers(client)
    p = add_patient(client, h)
    r = client.post("/api/patients/validate", json=VALID, headers=h)
    assert r.json()["valid"] is False  # same email already exists
    r = client.post(f"/api/patients/validate?exclude_id={p['id']}", json=VALID, headers=h)
    assert r.json()["valid"] is True


def test_duplicate_detection(client):
    h = auth_headers(client)
    add_patient(client, h, full_name="Madison XI", email="m1@ex.com")
    add_patient(client, h, full_name="madison  xi", email="m2@ex.com")
    r = client.get("/api/patients/duplicates", headers=h)
    assert len(r.json()["groups"]) == 1
    assert len(r.json()["groups"][0]["patients"]) == 2
