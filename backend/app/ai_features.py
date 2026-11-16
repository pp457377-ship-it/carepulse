"""Advanced AI features built on top of `call_llm` (Gemini).

Copilot chat, smart-intake parsing, panel insights and care plans are all
generated dynamically by the AI — there is no canned fallback content. When
Gemini is unreachable the features raise `AIUnavailable` and the API answers
503.
"""

import json
import re
from datetime import date

from .ai_service import AIUnavailable, assess_risk, call_llm

_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)

def _extract_json(text: str) -> dict | None:
    """Pull the first JSON object out of an LLM reply (handles ```json fences)."""
    m = _JSON_BLOCK.search(text or "")
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except (ValueError, TypeError):
        return None
    return data if isinstance(data, dict) else None


def _require(text: str | None) -> str:
    if not text:
        raise AIUnavailable("Gemini did not produce a response")
    return text


def _age(dob: str) -> int | None:
    try:
        d, m, y = (int(x) for x in dob.replace(".", "/").split("/"))
        today = date.today()
        return today.year - y - ((today.month, today.day) < (m, d))
    except Exception:
        return None


def _patient_snapshot(patient) -> str:
    age = _age(patient.date_of_birth)
    risk = assess_risk(patient.glucose, patient.haemoglobin, patient.cholesterol)
    flags = "; ".join(risk["flags"]) or "none"
    return (
        f"Patient: {patient.full_name} (DOB {patient.date_of_birth}"
        f"{f', ~{age}y' if age is not None else ''}, email {patient.email}). "
        f"Labs: glucose {patient.glucose} mg/dL, haemoglobin {patient.haemoglobin} g/dL, "
        f"cholesterol {patient.cholesterol} mg/dL. Health score "
        f"{patient.health_score}/100, risk {patient.risk_level}. Flags: {flags}. "
        f"Current remarks: {patient.remarks}"
    )


# ---------------------------------------------------------------- AI copilot

_SYSTEM = (
    "You are CarePulse Copilot, a clinical screening assistant for clinicians. "
    "Answer concisely in plain English, use short paragraphs or bullet points. "
    "Interpret lab markers (glucose mg/dL, haemoglobin g/dL, cholesterol mg/dL), "
    "suggest sensible follow-up steps and lifestyle measures. Never give a "
    "diagnosis or prescribe medication; recommend consulting a physician for "
    "anything beyond screening guidance."
)


def chat_reply(message: str, history: list[dict], patient=None) -> tuple[str, str]:
    """Conversational answer; patient record is injected as context when given."""
    context = f"\n\nContext — {_patient_snapshot(patient)}" if patient else ""
    turns = "".join(
        f"\n{'Clinician' if h.get('role') == 'user' else 'Copilot'}: {h.get('content', '')[:800]}"
        for h in (history or [])[-10:]
    )
    prompt = f"{_SYSTEM}{context}\n\nConversation so far:{turns or ' (none)'}\n\nClinician: {message}\nCopilot:"
    text, src = call_llm(prompt, max_tokens=2048, temperature=0.5)
    return _require(text), src


# ---------------------------------------------------------- smart intake NLP

_INTAKE_KEYS = ("full_name", "date_of_birth", "email", "glucose", "haemoglobin", "cholesterol")


def parse_intake(text: str) -> tuple[dict, str]:
    """Extract structured patient fields from free text. Returns (fields, source)."""
    prompt = (
        "Extract patient screening fields from this text and return ONLY a JSON "
        "object with keys: full_name (string), date_of_birth (string dd/mm/yyyy), "
        "email (string), glucose (number), haemoglobin (number), cholesterol "
        "(number). Use null for anything not present. Convert dates to "
        "dd/mm/yyyy. No prose, JSON only.\n\nText:\n" + text[:3000]
    )
    reply, src = call_llm(prompt, max_tokens=1024, temperature=0.0)
    data = _extract_json(_require(reply))
    if not data:
        raise AIUnavailable("Gemini returned unparseable output")
    fields = {k: data.get(k) for k in _INTAKE_KEYS if data.get(k) not in (None, "")}
    return fields, src


# ------------------------------------------------------------ panel insights

def panel_insights(patients: list) -> tuple[str, str]:
    """Narrative cohort analysis over the user's patient panel."""
    rows = "\n".join(
        f"- {p.full_name} | score {p.health_score} | risk {p.risk_level} | "
        f"G {p.glucose} Hb {p.haemoglobin} C {p.cholesterol}"
        for p in sorted(patients, key=lambda x: x.health_score)[:40]
    )
    prompt = (
        "You are CarePulse's panel-analysis AI. Below is a clinician's patient "
        "panel (sorted lowest health score first). Write a concise insight "
        "brief with these markdown sections:\n"
        "**Overview** — 2-3 sentences on overall panel health.\n"
        "**Priority patients** — bullet list naming who needs attention first and why.\n"
        "**Patterns** — notable trends (e.g. common flag, age band, marker combos).\n"
        "**Suggested actions** — 2-4 concrete workflow suggestions.\n"
        "No diagnosis, plain English, under 250 words.\n\nPanel:\n" + rows
    )
    text, src = call_llm(prompt, max_tokens=2048, temperature=0.5)
    return _require(text), src


# ------------------------------------------------------------------ care plan

_PLAN_KEYS = ("overview", "lifestyle", "diet", "monitoring", "follow_up", "red_flags")


def care_plan(patient) -> tuple[dict, str]:
    """Structured care plan for one patient. Returns (plan, source)."""
    prompt = (
        "You are a clinical screening assistant. Build a screening-level care "
        "plan for this patient. Return ONLY a JSON object with keys: "
        "overview (1-2 sentences), lifestyle (list of 3-4 strings), diet "
        "(list of 3-4 strings), monitoring (list of 2-3 follow-up tests with "
        "suggested timing), follow_up (list of 2-3 strings), red_flags "
        "(list of 2-3 warning symptoms to watch). No diagnosis. JSON only.\n\n"
        + _patient_snapshot(patient)
    )
    reply, src = call_llm(prompt, max_tokens=2048, temperature=0.4)
    data = _extract_json(_require(reply))
    if not data or not any(data.get(k) for k in _PLAN_KEYS):
        raise AIUnavailable("Gemini returned unparseable output")
    plan = {k: data.get(k) for k in _PLAN_KEYS}
    for k in _PLAN_KEYS[1:]:
        if not isinstance(plan[k], list):
            plan[k] = [plan[k]] if plan[k] else []
    plan["overview"] = str(plan.get("overview") or "")
    return plan, src
