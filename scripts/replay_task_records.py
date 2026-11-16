"""Submit the assessment-sheet records (data/task2_records.csv) to a running
CarePulse API, exactly as supplied, and print each verdict.

Usage:
    python scripts/replay_task_records.py --email you@clinic.com --password '...' [--base http://localhost:8000]

The account must already exist (register through the UI first).
"""
import argparse
import csv
from pathlib import Path

import httpx

CSV = Path(__file__).resolve().parents[1] / "data" / "task2_records.csv"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--email", required=True)
    ap.add_argument("--password", required=True)
    args = ap.parse_args()

    with CSV.open(newline="") as f:
        records = list(csv.DictReader(f))

    with httpx.Client(base_url=args.base.rstrip("/"), timeout=30) as c:
        r = c.post("/api/auth/login", json={"email": args.email, "password": args.password})
        r.raise_for_status()
        c.headers["Authorization"] = f"Bearer {r.json()['access_token']}"

        accepted = 0
        for n, rec in enumerate(records, 1):
            r = c.post("/api/patients", json=rec)
            ok = r.status_code == 201
            accepted += ok
            print(f"#{n:>2} {'OK ' if ok else 'ERR'} {r.status_code}  {rec['full_name']:<14} {rec['email']}")
            if not ok:
                detail = r.json().get("detail")
                for e in (detail.get("errors", [detail]) if isinstance(detail, dict) else [detail]):
                    print(f"        - {e}")
        print(f"\n{accepted} accepted, {len(records) - accepted} rejected")


if __name__ == "__main__":
    main()
