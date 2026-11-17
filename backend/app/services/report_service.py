"""
Security Report Generator Service (PDF via ReportLab + CSV Export).
Generates real, downloadable enterprise PDF reports for individual URL scans,
threat intelligence summaries, and security analytics, and persists metadata.
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.config import get_settings
from app.database.db import db

PRIMARY_BLUE = colors.HexColor("#1D4ED8")
DARK_SLATE = colors.HexColor("#0F172A")
MUTED_SLATE = colors.HexColor("#475569")
LIGHT_BG = colors.HexColor("#F8FAFC")
BORDER_GREY = colors.HexColor("#CBD5E1")


def _reports_dir() -> Path:
    path = Path(get_settings().reports_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_text(val: Any) -> str:
    text = str(val if val is not None else "N/A")
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _build_pdf_styles():
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "PGTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        textColor=PRIMARY_BLUE,
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "PGSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        textColor=MUTED_SLATE,
        spaceAfter=14,
    )
    section_style = ParagraphStyle(
        "PGSection",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=DARK_SLATE,
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "PGBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=14,
        textColor=DARK_SLATE,
    )
    return title_style, subtitle_style, section_style, body_style


def generate_scan_pdf_report(scan: Dict[str, Any], title: Optional[str] = None) -> Dict[str, Any]:
    report_id = str(uuid.uuid4())
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    file_name = f"phishguard_scan_{report_id[:8]}.pdf"
    file_path = _reports_dir() / file_name

    report_title = title or f"URL Threat Assessment: {scan['domain']}"
    doc = SimpleDocTemplate(
        str(file_path),
        pagesize=letter,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
    )
    title_style, subtitle_style, section_style, body_style = _build_pdf_styles()
    story: List[Any] = []

    story.append(Paragraph("PhishGuard Security Assessment Report", title_style))
    story.append(
        Paragraph(
            f"Generated: {now_str} | Report ID: {report_id[:8]} | Classification: {_safe_text(scan['classification'])}",
            subtitle_style,
        )
    )

    # Summary Table
    story.append(Paragraph("1. Executive Scan Summary", section_style))
    summary_data = [
        ["Target URL", Paragraph(_safe_text(scan["normalized_url"]), body_style)],
        ["Domain / Host", _safe_text(scan["domain"])],
        ["Resolved IP", _safe_text(scan.get("ip_address") or "Unresolved")],
        ["Final Classification", _safe_text(scan["classification"])],
        ["Combined Risk Score", f"{scan['risk_score']} / 100"],
        ["ML Prediction", f"{scan['ml_prediction'].upper()} ({scan['ml_confidence'] * 100:.1f}% confidence)"],
        ["Threat Category", _safe_text(scan.get("threat_category", "None"))],
        ["Detection Source", _safe_text(scan.get("detection_source", "ML + Correlation"))],
        ["Scanned At", _safe_text(scan["scanned_at"])],
    ]
    tbl = Table(summary_data, colWidths=[1.8 * inch, 5.2 * inch])
    tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), LIGHT_BG),
            ("TEXTCOLOR", (0, 0), (0, -1), DARK_SLATE),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GREY),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("PADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(tbl)
    story.append(Spacer(1, 10))

    # Detection Reasons
    story.append(Paragraph("2. Detection Reasons & Correlation Findings", section_style))
    for reason in scan.get("detection_reasons", []):
        story.append(Paragraph(f"• {_safe_text(reason)}", body_style))
        story.append(Spacer(1, 3))

    # External Intelligence Status
    story.append(Paragraph("3. External Threat Intelligence Summary", section_style))
    ti_rows = [["Provider", "Status", "Match", "Summary"]]
    for key, label in [("virustotal_result", "VirusTotal"), ("urlhaus_result", "URLhaus"), ("abuseipdb_result", "AbuseIPDB")]:
        res = scan.get(key) or {}
        ti_rows.append([
            label,
            _safe_text(res.get("status", "not_configured")),
            "Yes" if res.get("matched") else "No",
            Paragraph(_safe_text(res.get("message", "No data available.")), body_style),
        ])
    ti_table = Table(ti_rows, colWidths=[1.1 * inch, 1.1 * inch, 0.7 * inch, 4.1 * inch])
    ti_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GREY),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("PADDING", (0, 0), (-1, -1), 5),
        ])
    )
    story.append(ti_table)
    story.append(Spacer(1, 10))

    # Recommendations
    story.append(Paragraph("4. Security Recommendations", section_style))
    for rec in scan.get("recommendations", []):
        story.append(Paragraph(f"• {_safe_text(rec)}", body_style))
        story.append(Spacer(1, 3))

    doc.build(story)

    return db.save_report({
        "id": report_id,
        "scan_id": scan["id"],
        "title": report_title,
        "report_type": "url_scan",
        "format": "pdf",
        "summary": f"{scan['classification']} (Risk {scan['risk_score']}/100) — {scan['normalized_url']}",
        "file_name": file_name,
        "metadata": {
            "url": scan["normalized_url"],
            "risk_score": scan["risk_score"],
            "classification": scan["classification"],
        },
    })


def generate_threat_intel_pdf_report(title: Optional[str] = None) -> Dict[str, Any]:
    report_id = str(uuid.uuid4())
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    file_name = f"phishguard_threat_intel_{report_id[:8]}.pdf"
    file_path = _reports_dir() / file_name

    scans = db.get_all_scans(limit=200)
    indicators = db.list_indicators(limit=50)
    integrations = db.list_integrations()

    total_scans = len(scans)
    phishing_count = sum(1 for s in scans if s["classification"] == "Phishing")
    malicious_count = sum(1 for s in scans if s["classification"] == "Malicious")
    suspicious_count = sum(1 for s in scans if s["classification"] == "Suspicious")
    safe_count = sum(1 for s in scans if s["classification"] == "Safe")

    report_title = title or f"Threat Intelligence & Correlation Report ({datetime.now(timezone.utc).strftime('%Y-%m-%d')})"
    doc = SimpleDocTemplate(
        str(file_path),
        pagesize=letter,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
    )
    title_style, subtitle_style, section_style, body_style = _build_pdf_styles()
    story: List[Any] = []

    story.append(Paragraph("PhishGuard Threat Intelligence Report", title_style))
    story.append(Paragraph(f"Generated: {now_str} | Active IoCs: {len(indicators)} | Scans Reviewed: {total_scans}", subtitle_style))

    story.append(Paragraph("1. Threat Posture Overview", section_style))
    overview_data = [
        ["Total Scanned URLs", str(total_scans), "Safe URLs", str(safe_count)],
        ["Phishing Detected", str(phishing_count), "Malicious / Critical", str(malicious_count)],
        ["Suspicious URLs", str(suspicious_count), "Tracked Threat IoCs", str(len(indicators))],
    ]
    ov_table = Table(overview_data, colWidths=[1.8 * inch, 1.5 * inch, 1.8 * inch, 1.9 * inch])
    ov_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), LIGHT_BG),
            ("BACKGROUND", (2, 0), (2, -1), LIGHT_BG),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GREY),
            ("PADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(ov_table)
    story.append(Spacer(1, 10))

    story.append(Paragraph("2. Configured Threat Intelligence Integrations", section_style))
    int_rows = [["Provider", "Configured", "Status", "Queries", "Matches"]]
    for item in integrations:
        int_rows.append([
            _safe_text(item["display_name"]),
            "Yes" if item["is_configured"] else "No",
            _safe_text(item["status"]),
            str(item["total_queries"]),
            str(item["total_matches"]),
        ])
    int_tbl = Table(int_rows, colWidths=[1.6 * inch, 1.2 * inch, 1.6 * inch, 1.3 * inch, 1.3 * inch])
    int_tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GREY),
            ("PADDING", (0, 0), (-1, -1), 5),
        ])
    )
    story.append(int_tbl)
    story.append(Spacer(1, 10))

    story.append(Paragraph("3. Recent Threat Indicators (IoCs)", section_style))
    ioc_rows = [["Type", "Indicator", "Category", "Source", "Confidence"]]
    for ind in indicators[:20]:
        ioc_rows.append([
            _safe_text(ind["indicator_type"]).upper(),
            Paragraph(_safe_text(ind["indicator_value"]), body_style),
            Paragraph(_safe_text(ind["threat_category"]), body_style),
            _safe_text(ind["source"]),
            f"{ind['confidence_score']}%" if ind.get("confidence_score") is not None else "N/A",
        ])
    ioc_tbl = Table(ioc_rows, colWidths=[0.7 * inch, 2.3 * inch, 1.8 * inch, 1.3 * inch, 0.9 * inch])
    ioc_tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GREY),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("PADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(ioc_tbl)

    doc.build(story)

    return db.save_report({
        "id": report_id,
        "scan_id": None,
        "title": report_title,
        "report_type": "threat_intelligence",
        "format": "pdf",
        "summary": f"{total_scans} scans analyzed ({phishing_count + malicious_count} high-risk), {len(indicators)} tracked IoCs.",
        "file_name": file_name,
        "metadata": {
            "total_scans": total_scans,
            "indicators_count": len(indicators),
        },
    })


def generate_scans_csv_bytes() -> bytes:
    scans = db.get_all_scans(limit=1000)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "Scan ID",
        "Scanned At",
        "URL",
        "Domain",
        "IP Address",
        "Classification",
        "Risk Score",
        "ML Prediction",
        "ML Confidence",
        "Threat Category",
        "Detection Source",
    ])
    for s in scans:
        writer.writerow([
            s["id"],
            s["scanned_at"],
            s["normalized_url"],
            s["domain"],
            s.get("ip_address") or "",
            s["classification"],
            s["risk_score"],
            s["ml_prediction"],
            f"{s['ml_confidence']:.4f}",
            s.get("threat_category", ""),
            s.get("detection_source", ""),
        ])
    return buffer.getvalue().encode("utf-8")


def get_report_file_path(file_name: str) -> Path:
    safe_name = Path(file_name).name
    return _reports_dir() / safe_name
