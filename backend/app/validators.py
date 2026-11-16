"""Field validation for patient records.

Collects ALL errors at once (the task requires showing every problem in a
single response). Dates are accepted as dd/mm/yyyy, dd.mm.yyyy or dd-mm-yyyy
(the task sheet itself uses dots) and normalised to dd/mm/yyyy.
"""

import re
from datetime import date

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
NAME_RE = re.compile(r"^[A-Za-z][A-Za-z .'-]*$")

BOUNDS = {
    "glucose": (20.0, 800.0, "mg/dL"),
    "haemoglobin": (2.0, 25.0, "g/dL"),
    "cholesterol": (50.0, 800.0, "mg/dL"),
}


def parse_dob(raw: str) -> tuple[date | None, str | None]:
    """Return (date, error). Normalises . and - separators to /."""
    cleaned = raw.strip().replace(".", "/").replace("-", "/")
    parts = cleaned.split("/")
    if len(parts) != 3 or not all(p.isdigit() for p in parts):
        return None, "date_of_birth: use dd/mm/yyyy"
    day, month, year = (int(p) for p in parts)
    try:
        dob = date(year, month, day)
    except ValueError:
        return None, "date_of_birth: invalid calendar date"
    if dob > date.today():
        return None, "date_of_birth: cannot be in the future"
    if dob.year < 1900:
        return None, "date_of_birth: year must be 1900 or later"
    return dob, None


def validate_patient_payload(data: dict) -> list[str]:
    errors: list[str] = []

    name = (data.get("full_name") or "").strip()
    if not name:
        errors.append("full_name: required")
    elif not NAME_RE.match(name):
        errors.append("full_name: letters, spaces, apostrophes, hyphens and dots only")

    email = (data.get("email") or "").strip()
    if not email:
        errors.append("email: required")
    elif not EMAIL_RE.match(email):
        errors.append("email: invalid email address")

    if not (data.get("date_of_birth") or "").strip():
        errors.append("date_of_birth: required")
    else:
        _, err = parse_dob(data["date_of_birth"])
        if err:
            errors.append(err)

    for field, (lo, hi, unit) in BOUNDS.items():
        raw = data.get(field)
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            errors.append(f"{field}: required")
            continue
        try:
            val = float(raw)
        except (TypeError, ValueError):
            errors.append(f"{field}: must be a number")
            continue
        if not (lo <= val <= hi):
            errors.append(f"{field}: must be between {lo} and {hi} {unit}")

    return errors


def normalise_dob(raw: str) -> str:
    dob, _ = parse_dob(raw)
    return dob.strftime("%d/%m/%Y")


def rules_catalogue() -> list[dict]:
    """Human-readable rule list generated from the constants above."""
    rules = [
        {"field": "full_name", "rule": "Required; letters, spaces, apostrophes, hyphens and dots only",
         "pattern": NAME_RE.pattern},
        {"field": "email", "rule": "Required; must look like name@domain.tld (a top-level domain is required)",
         "pattern": EMAIL_RE.pattern},
        {"field": "email", "rule": "Unique per account — a second record with the same email is rejected (HTTP 409)"},
        {"field": "date_of_birth", "rule": "dd/mm/yyyy (dd.mm.yyyy and dd-mm-yyyy are also accepted and normalised); must be a real calendar date"},
        {"field": "date_of_birth", "rule": f"Cannot be in the future (today is {date.today():%d/%m/%Y}); year must be 1900 or later"},
    ]
    for field, (lo, hi, unit) in BOUNDS.items():
        rules.append({"field": field, "rule": f"Numeric, {lo:g}–{hi:g} {unit}", "min": lo, "max": hi, "unit": unit})
    rules.append({"field": "*", "rule": "Every failing rule is returned together in one response (HTTP 422), not one at a time"})
    return rules
