"""AI assessment engine — powered by Google Gemini.

Two layers:

1. `assess_risk` — deterministic clinical thresholds that decide each marker's
   status (normal / low / borderline / high / critical) and the overall
   0–100 health score + risk level. Scoring stays deterministic so results are
   consistent and auditable.

2. AI-written content — all human-readable text (marker notes, recommendations,
   remarks) is generated dynamically by Gemini (`generateContent`). No canned
   fallback prose: if Gemini is unreachable the record is flagged as
   ``ai_source='unavailable'`` so it can be re-run later.
"""

import json
import re

import httpx

from .config import settings

SEVERITY_DEDUCT = {"mild": 8, "moderate": 18, "severe": 35}
STATUS_SEVERITY = {
    "normal": "none",
    "low": "moderate",
    "borderline": "mild",
    "high": "moderate",
    "critical": "severe",
}

_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)


class AIUnavailable(RuntimeError):
    """Raised when Gemini could not produce a response."""


def _glucose_status(g: float) -> str:
    if g >= 180:
        return "critical"
    if g >= 126:
        return "high"
    if g >= 100:
        return "borderline"
    if g < 70:
        return "low"
    return "normal"


def _haemoglobin_status(hb: float) -> str:
    if hb < 8:
        return "critical"
    if hb < 12:
        return "low"
    if hb > 17.5:
        return "high"
    return "normal"


def _cholesterol_status(c: float) -> str:
    if c >= 300:
        return "critical"
    if c >= 240:
        return "high"
    if c >= 200:
        return "borderline"
    return "normal"


def assess_risk(glucose: float, haemoglobin: float, cholesterol: float) -> dict:
    """Deterministic scoring skeleton: statuses, score, risk level.

    Marker ``note``/``recommendation`` fields are left empty here — they are
    filled with AI-generated text by `ai_assess`.
    """
    markers = [
        {"name": "glucose", "label": "Glucose", "value": glucose, "unit": "mg/dL",
         "status": _glucose_status(glucose)},
        {"name": "haemoglobin", "label": "Haemoglobin", "value": haemoglobin,
         "unit": "g/dL", "status": _haemoglobin_status(haemoglobin)},
        {"name": "cholesterol", "label": "Cholesterol", "value": cholesterol,
         "unit": "mg/dL", "status": _cholesterol_status(cholesterol)},
    ]
    for m in markers:
        m["severity"] = STATUS_SEVERITY[m["status"]]
        m["note"] = ""
        m["recommendation"] = ""
    score = max(0, 100 - sum(SEVERITY_DEDUCT.get(m["severity"], 0) for m in markers))
    risk = "low" if score >= 80 else "moderate" if score >= 55 else "high"
    flagged = [m for m in markers if m["status"] != "normal"]
    return {"score": score, "risk_level": risk, "markers": markers,
            "flags": [f"{m['label']} {m['status']}" for m in flagged],
            "recommendations": []}


def _extract_json(text: str) -> dict | None:
    m = _JSON_BLOCK.search(text or "")
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except (ValueError, TypeError):
        return None
    return data if isinstance(data, dict) else None


def _has_key() -> bool:
    return bool(settings.gemini_api_key) and settings.gemini_api_key.lower() != "xxxxx"


def call_llm(prompt: str, max_tokens: int = 2048, temperature: float = 0.4) -> tuple[str | None, str]:
    """Send a single-turn prompt to Gemini.

    Returns (text, source) — text is None when no key is configured or the
    call failed, letting callers raise `AIUnavailable`.
    """
    if not _has_key():
        return None, "gemini"
    model = settings.gemini_model or "gemini-3-flash-preview"
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}"
        f":generateContent?key={settings.gemini_api_key}"
    )
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": max_tokens,
                                 "temperature": temperature}}
    try:
        r = httpx.post(url, json=body, timeout=60)
        r.raise_for_status()
        parts = r.json()["candidates"][0]["content"]["parts"]
        text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
        return text.strip(), "gemini"
    except Exception:
        return None, "gemini"


def llm_available() -> bool:
    """True when a Gemini API key is configured."""
    return _has_key()


_ASSESS_PROMPT = (
    "You are a clinical screening assistant. A patient has these lab markers "
    "with computed statuses (glucose mg/dL, haemoglobin g/dL, cholesterol "
    "mg/dL). Write per-marker clinical notes and recommendations plus an "
    "overall remark.\n"
    "Return ONLY a JSON object, no prose, no markdown fences:\n"
    '{{"markers": [{{"name": "glucose"|"haemoglobin"|"cholesterol", '
    '"note": "<short clinical note>", "recommendation": "<next step>"}}], '
    '"remarks": "<1-2 sentence overall health remark>"}}\n'
    "Rules: a note/recommendation for EVERY marker (including normal ones), "
    "plain English, no diagnosis, no medication prescriptions.\n\n"
    "Patient: {name} (DOB {dob}). Labs and statuses:\n{markers}\n"
    "Overall risk: {risk_level} (score {score}/100)."
)


def ai_assess(name: str, dob: str, g: float, hb: float, c: float) -> tuple[dict, str]:
    """Full patient assessment: deterministic score/risk + AI-written content.

    Returns (result, source). result keys: score, risk_level, markers
    (each with AI note/recommendation), remarks. Source is "gemini" or
    "unavailable" when the AI call failed.
    """
    risk = assess_risk(g, hb, c)
    marker_lines = "\n".join(
        f"- {m['name']}: {m['value']} {m['unit']} — {m['status']}"
        for m in risk["markers"])
    prompt = _ASSESS_PROMPT.format(
        name=name, dob=dob, markers=marker_lines,
        risk_level=risk["risk_level"], score=risk["score"])
    text, _ = call_llm(prompt, max_tokens=2048, temperature=0.4)
    data = _extract_json(text or "")
    if data:
        by_name = {m.get("name"): m for m in data.get("markers", []) if isinstance(m, dict)}
        for m in risk["markers"]:
            ai = by_name.get(m["name"], {})
            m["note"] = str(ai.get("note") or f"{m['label']} is {m['status']}")
            m["recommendation"] = str(ai.get("recommendation") or "")
        risk["flags"] = [m["note"] for m in risk["markers"] if m["status"] != "normal"]
        risk["recommendations"] = [m["recommendation"] for m in risk["markers"]
                                   if m["status"] != "normal" and m["recommendation"]]
        risk["remarks"] = str(data.get("remarks") or "")
        return risk, "gemini"
    for m in risk["markers"]:
        m["note"] = f"{m['label']} is {m['status']}"
        m["recommendation"] = "Re-run AI assessment for detailed guidance."
    risk["flags"] = [m["note"] for m in risk["markers"] if m["status"] != "normal"]
    risk["recommendations"] = [m["recommendation"] for m in risk["markers"]
                               if m["status"] != "normal"]
    risk["remarks"] = "AI assessment unavailable — check the Gemini key and re-run AI."
    return risk, "unavailable"


