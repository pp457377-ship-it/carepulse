"""Replay of the 10 records from the assessment task sheet — unmodified.

Expected: records 1,3,5,7,9,10 are accepted (6 total); records 2,4,6,8 fail:
  #2  email `timd@smh` has no TLD
  #4  31/11 is not a real calendar date
  #6  exact duplicate of #1's email
  #8  DOB in the future AND email missing '@' — both errors at once
"""

from conftest import auth_headers

RECORDS = [
    {"full_name": "Robyn Pears", "date_of_birth": "28/01/1960",
     "email": "robyn@gmail.com", "glucose": 232, "haemoglobin": 13.5,
     "cholesterol": 180},
    {"full_name": "Darryl Tim", "date_of_birth": "12/11/1993",
     "email": "timd@smh", "glucose": 240, "haemoglobin": 18.6,
     "cholesterol": 326},
    {"full_name": "Sam Kerr", "date_of_birth": "09/12/2006",
     "email": "sam@news.com.au", "glucose": 198, "haemoglobin": 8.9,
     "cholesterol": 192},
    {"full_name": "Madison XI", "date_of_birth": "31/11/1998",
     "email": "madison@hotmail.com", "glucose": 85, "haemoglobin": 7.6,
     "cholesterol": 163},
    {"full_name": "Madison XI", "date_of_birth": "12/09/1998",
     "email": "madison@hotmail.com", "glucose": 85, "haemoglobin": 7.6,
     "cholesterol": 163},
    {"full_name": "Robyn Pears", "date_of_birth": "28/01/1960",
     "email": "robyn@gmail.com", "glucose": 232, "haemoglobin": 13.5,
     "cholesterol": 180},
    {"full_name": "Mary Fit", "date_of_birth": "15/06/1975",
     "email": "mary@fit.com", "glucose": 95, "haemoglobin": 14.2,
     "cholesterol": 190},
    {"full_name": "Kris Wu", "date_of_birth": "19/10/2030",
     "email": "Kris.wu.gmail.com", "glucose": 140, "haemoglobin": 12.5,
     "cholesterol": 260},
    {"full_name": "Tenille Singh", "date_of_birth": "30/11/1991",
     "email": "tenille@yahoo.com", "glucose": 101, "haemoglobin": 15,
     "cholesterol": 310},
    {"full_name": "Prem Kumar", "date_of_birth": "28/04/1990",
     "email": "prem@telstra.com", "glucose": 155, "haemoglobin": 12.5,
     "cholesterol": 265},
]

EXPECTED = [201, 422, 201, 422, 201, 409, 201, 422, 201, 201]


def test_replay_task_sheet_records(client):
    headers = auth_headers(client, "assessor@test.dev")
    statuses = []
    for rec in RECORDS:
        r = client.post("/api/patients", json=rec, headers=headers)
        statuses.append(r.status_code)
    assert statuses == EXPECTED
    r = client.get("/api/patients?page_size=100", headers=headers)
    assert r.json()["total"] == 6


def test_second_record_error_mentions_email(client):
    headers = auth_headers(client, "assessor@test.dev")
    r = client.post("/api/patients", json=RECORDS[1], headers=headers)
    assert any("email" in e for e in r.json()["detail"]["errors"])


def test_eighth_record_shows_both_errors(client):
    headers = auth_headers(client, "assessor@test.dev")
    r = client.post("/api/patients", json=RECORDS[7], headers=headers)
    errs = r.json()["detail"]["errors"]
    assert len(errs) == 2


def test_edit_one_record_to_gokul_email(client):
    headers = auth_headers(client, "assessor@test.dev")
    r = client.post("/api/patients", json=RECORDS[0], headers=headers)
    pid = r.json()["id"]
    r = client.put(f"/api/patients/{pid}",
                   json={"email": "gokul@infocare.com"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["email"] == "gokul@infocare.com"


def test_delete_one_record(client):
    headers = auth_headers(client, "assessor@test.dev")
    pid = client.post("/api/patients", json=RECORDS[0],
                      headers=headers).json()["id"]
    assert client.delete(f"/api/patients/{pid}", headers=headers).status_code == 204
    assert client.get("/api/patients", headers=headers).json()["total"] == 0
