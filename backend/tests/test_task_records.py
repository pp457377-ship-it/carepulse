"""Feeds the assessment-sheet CSV (data/task2_records.csv) through the real
create endpoint, exactly as a user typing them in would."""
import csv
from pathlib import Path

from conftest import auth_headers

CSV = Path(__file__).resolve().parents[2] / "data" / "task2_records.csv"


def _records():
    with CSV.open(newline="") as f:
        return list(csv.DictReader(f))


def test_sheet_records_six_accepted_four_rejected(client):
    h = auth_headers(client)
    results = [client.post("/api/patients", json=rec, headers=h) for rec in _records()]
    codes = [r.status_code for r in results]
    assert codes == [201, 422, 201, 422, 201, 409, 201, 422, 201, 201]
    assert any("email" in e for e in results[1].json()["detail"]["errors"])
    assert any("calendar" in e for e in results[3].json()["detail"]["errors"])
    errs8 = results[7].json()["detail"]["errors"]
    assert len(errs8) == 2 and any("future" in e for e in errs8) and any("email" in e for e in errs8)
    assert client.get("/api/patients", headers=h).json()["total"] == 6


def test_sheet_records_via_csv_import(client):
    h = auth_headers(client)
    with CSV.open("rb") as f:
        r = client.post("/api/patients/import", files={"file": ("task2.csv", f, "text/csv")}, headers=h)
    assert r.status_code == 200
    assert r.json()["created"] == 6 and r.json()["failed"] == 4
