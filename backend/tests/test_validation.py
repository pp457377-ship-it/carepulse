from conftest import VALID, auth_headers

P = "/api/patients"


def errors(resp):
    return resp.json()["detail"]["errors"]


def test_bad_email_rejected(client):
    h = auth_headers(client)
    r = client.post(P, json=VALID | {"email": "not-an-email"}, headers=h)
    assert r.status_code == 422
    assert any("email" in e for e in errors(r))


def test_email_without_tld_rejected(client):
    h = auth_headers(client)
    r = client.post(P, json=VALID | {"email": "a@b"}, headers=h)
    assert r.status_code == 422


def test_future_dob_rejected(client):
    h = auth_headers(client)
    r = client.post(P, json=VALID | {"date_of_birth": "19/10/2030"}, headers=h)
    assert r.status_code == 422
    assert any("future" in e for e in errors(r))


def test_impossible_date_rejected(client):
    h = auth_headers(client)
    r = client.post(P, json=VALID | {"date_of_birth": "31/11/1990"}, headers=h)
    assert r.status_code == 422
    assert any("invalid calendar date" in e for e in errors(r))


def test_dot_separated_dob_accepted(client):
    h = auth_headers(client)
    r = client.post(P, json=VALID | {"date_of_birth": "19.10.1990",
                                     "email": "dot@ex.com"}, headers=h)
    assert r.status_code == 201
    assert r.json()["date_of_birth"] == "19/10/1990"


def test_all_errors_returned_together(client):
    h = auth_headers(client)
    r = client.post(P, json=VALID | {"date_of_birth": "19/10/2030",
                                     "email": "Kris.wu.gmail.com"}, headers=h)
    assert r.status_code == 422
    errs = errors(r)
    assert len(errs) == 2
    assert any("future" in e for e in errs)
    assert any("email" in e for e in errs)


def test_non_numeric_lab_rejected(client):
    h = auth_headers(client)
    r = client.post(P, json=VALID | {"glucose": "high"}, headers=h)
    assert r.status_code == 422


def test_out_of_bounds_lab_rejected(client):
    h = auth_headers(client)
    r = client.post(P, json=VALID | {"haemoglobin": 60.0}, headers=h)
    assert r.status_code == 422
    assert any("between" in e for e in errors(r))


def test_bad_name_rejected(client):
    h = auth_headers(client)
    r = client.post(P, json=VALID | {"full_name": "!!"}, headers=h)
    assert r.status_code == 422


def test_missing_fields_rejected(client):
    h = auth_headers(client)
    r = client.post(P, json={}, headers=h)
    assert r.status_code == 422
