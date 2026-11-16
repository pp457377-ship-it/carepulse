"""PDF clinical report generation for a single patient (reportlab)."""

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

from .models import Patient

TEAL = colors.HexColor("#0d9488")
SLATE = colors.HexColor("#334155")
LIGHT = colors.HexColor("#f1f5f9")

STATUS_COLORS = {
    "normal": colors.HexColor("#16a34a"),
    "low": colors.HexColor("#d97706"),
    "borderline": colors.HexColor("#d97706"),
    "high": colors.HexColor("#ea580c"),
    "critical": colors.HexColor("#dc2626"),
}


def build_patient_report(patient: Patient) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm,
                            title=f"CarePulse report — {patient.full_name}")
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1x", parent=styles["Title"], textColor=TEAL, fontSize=22)
    h2 = ParagraphStyle("h2x", parent=styles["Heading2"], textColor=SLATE, fontSize=13)
    body = ParagraphStyle("bodyx", parent=styles["BodyText"], fontSize=10.5,
                          leading=15, textColor=SLATE)
    small = ParagraphStyle("smallx", parent=body, fontSize=8.5,
                           textColor=colors.HexColor("#64748b"))

    story = [
        Paragraph("CarePulse — Patient Screening Report", h1),
        Paragraph(f"Generated {datetime.now().strftime('%d %b %Y, %H:%M')} · "
                  f"AI engine: {patient.ai_source}", small),
        Spacer(1, 8 * mm),
        Paragraph("Patient", h2),
        Table([
            ["Full name", patient.full_name],
            ["Date of birth", patient.date_of_birth],
            ["Email", patient.email],
            ["Risk level", patient.risk_level.upper()],
            ["Health score", f"{patient.health_score} / 100"],
        ], colWidths=[40 * mm, 120 * mm], style=TableStyle([
            ("FONT", (0, 0), (-1, -1), "Helvetica", 10),
            ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 10),
            ("TEXTCOLOR", (0, 0), (0, -1), SLATE),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, LIGHT]),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ])),
        Spacer(1, 6 * mm),
        Paragraph("Screening markers", h2),
    ]

    rows = [["Marker", "Value", "Status", "Finding"]]
    latest = patient.assessments[-1] if patient.assessments else None
    markers = (latest.detail or {}).get("markers", []) if latest else []
    for m in markers:
        rows.append([m.get("label", ""), f"{m.get('value')} {m.get('unit', '')}",
                     m.get("status", "").upper(), m.get("note", "")])
    if not markers:
        rows.append(["Glucose", f"{patient.glucose} mg/dL", "—", "—"])
        rows.append(["Haemoglobin", f"{patient.haemoglobin} g/dL", "—", "—"])
        rows.append(["Cholesterol", f"{patient.cholesterol} mg/dL", "—", "—"])
    t = Table(rows, colWidths=[32 * mm, 32 * mm, 26 * mm, 70 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TEAL),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 9.5),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TEXTCOLOR", (2, 1), (2, -1), colors.HexColor("#b45309")),
    ]))
    for i, m in enumerate(markers, start=1):
        c = STATUS_COLORS.get(m.get("status"), SLATE)
        t.setStyle(TableStyle([("TEXTCOLOR", (2, i), (2, i), c)]))
    story += [t, Spacer(1, 6 * mm), Paragraph("AI clinical remarks", h2),
              Paragraph(patient.remarks or "—", body)]

    recs = (latest.detail or {}).get("recommendations", []) if latest else []
    if recs:
        story += [Spacer(1, 4 * mm), Paragraph("Recommendations", h2)]
        for r in recs:
            story.append(Paragraph(f"• {r}", body))

    story += [Spacer(1, 8 * mm),
              Paragraph("Screening tool only — not a medical diagnosis.", small)]
    doc.build(story)
    return buf.getvalue()
