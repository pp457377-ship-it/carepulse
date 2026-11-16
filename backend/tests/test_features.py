"""v2 feature tests: assessments, health score, CSV import/export,
audit log, trends, PDF report."""

import io

from conftest import VALID, add_patient, auth_headers


def test_health_score_perfect_for_normal_labs(client):
    h = auth_headers(client)
    p = add_patient(client, h)
    assert p["health_score"] == 100
    assert p["risk_level"] == "low"


def test_assessment_snapshot_created(client):
    h = auth_headers(client)
    p = add_patient(client, h, glucose=250)
    r = client.get(f"/api/patients/{p['id']}/assessments", headers=h)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    a = items[0]
    assert a["score"] < 100
    assert a["detail"]["markers"][0]["name"] == "glucose"
    assert a["detail"]["markers"][0]["status"] in ("high", "critical")
    assert a["detail"]["recommendations"]


def test_history_grows_and_score_drops_on_lab_update(client):
    h = auth_headers(client)
    p = add_patient(client, h)
    client.put(f"/api/patients/{p['id']}", json={"glucose": 240.0}, headers=h)
    items = client.get(f"/api/patients/{p['id']}/assessments", headers=h).json()
    assert len(items) == 2
    assert items[0]["score"] > items[1]["score"]


def test_csv_export(client):
    h = auth_headers(client)
    add_patient(client, h)
    r = client.get("/api/patients/export.csv", headers=h)
    assert r.status_code == 200
    assert "full_name,date_of_birth,email,glucose" in r.text
    assert "Jane Example" in r.text
    assert r.headers["content-type"].startswith("text/csv")


def test_csv_import_mixed_rows(client):
    h = auth_headers(client)
    csv_text = (
        "full_name,date_of_birth,email,glucose,haemoglobin,cholesterol\n"
        "Good One,12/05/1990,good1@ex.com,95,13.4,180\n"
        "Good Two,12/05/1991,good2@ex.com,100,12.4,200\n"
        "Bad Email,12/05/1990,not-an-email,95,13.4,180\n"
        "Future Dob,12/05/2031,fut@ex.com,95,13.4,180\n"
    )
    r = client.post("/api/patients/import", headers=h,
                    files={"file": ("patients.csv", io.BytesIO(csv_text.encode()),
                                    "text/csv")})
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 2
    assert body["failed"] == 2
    rows = {e["row"] for e in body["errors"]}
    assert rows == {4, 5}


def test_csv_import_missing_columns_422(client):
    h = auth_headers(client)
    r = client.post("/api/patients/import", headers=h,
                    files={"file": ("x.csv", io.BytesIO(b"a,b\n1,2\n"),
                                    "text/csv")})
    assert r.status_code == 422


def test_audit_log_records_mutations(client):
    h = auth_headers(client)
    p = add_patient(client, h)
    client.delete(f"/api/patients/{p['id']}", headers=h)
    r = client.get("/api/audit?limit=50", headers=h)
    actions = [e["action"] for e in r.json()]
    assert "patient.created" in actions
    assert "patient.deleted" in actions


def test_trends_endpoint(client):
    h = auth_headers(client)
    add_patient(client, h, glucose=95)    # 70–99 bucket
    add_patient(client, h, glucose=200, email="x@ex.com")  # 180+
    r = client.get("/api/analytics/trends", headers=h)
    assert r.status_code == 200
    dist = {d["bucket"]: d["count"] for d in r.json()["glucose_distribution"]}
    assert dist["70–99"] == 1
    assert dist["180+"] == 1
    assert r.json()["assessments_per_day"][0]["count"] == 2


def test_pdf_report(client):
    h = auth_headers(client)
    p = add_patient(client, h, glucose=240)
    r = client.get(f"/api/patients/{p['id']}/report.pdf", headers=h)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:5] == b"%PDF-"


def test_summary_includes_score_fields(client):
    h = auth_headers(client)
    add_patient(client, h)
    r = client.get("/api/analytics/summary", headers=h)
    assert "avg_health_score" in r.json()
    assert "top_risk" in r.json()
