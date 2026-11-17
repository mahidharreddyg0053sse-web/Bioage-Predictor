"""Security Reports & Export API endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Response, status
from fastapi.responses import FileResponse

from app.database.db import db
from app.models.schemas import ReportGenerateRequest
from app.services.report_service import (
    generate_scan_pdf_report,
    generate_scans_csv_bytes,
    generate_threat_intel_pdf_report,
    get_report_file_path,
)

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("")
async def list_reports() -> Dict[str, Any]:
    items = db.list_reports(limit=50)
    return {
        "items": items,
        "total": len(items),
    }


@router.post("/generate")
async def generate_report(payload: ReportGenerateRequest) -> Dict[str, Any]:
    if payload.report_type == "url_scan":
        if not payload.scan_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="scan_id is required to generate an individual URL scan report.",
            )
        scan = db.get_scan_by_id(payload.scan_id)
        if not scan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target scan record not found.",
            )
        report = generate_scan_pdf_report(scan, title=payload.title)
        return report

    # threat_intelligence or analytics_summary
    report = generate_threat_intel_pdf_report(title=payload.title)
    return report


@router.get("/export/csv")
async def export_scans_csv() -> Response:
    csv_bytes = generate_scans_csv_bytes()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"phishguard_scans_{stamp}.csv"

    db.save_report({
        "title": f"Scan History CSV Export ({stamp})",
        "report_type": "csv_export",
        "format": "csv",
        "summary": "Full scan history exported in CSV format.",
        "file_name": filename,
        "metadata": {"bytes": len(csv_bytes)},
    })

    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{report_id}/download")
async def download_report(report_id: str):
    report = db.get_report_by_id(report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    if report["format"] == "csv":
        csv_bytes = generate_scans_csv_bytes()
        return Response(
            content=csv_bytes,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{report["file_name"]}"'},
        )

    file_path = get_report_file_path(report["file_name"])
    if not file_path.exists():
        # Regenerate on demand if file was removed
        if report["report_type"] == "url_scan" and report.get("scan_id"):
            scan = db.get_scan_by_id(report["scan_id"])
            if scan:
                regen = generate_scan_pdf_report(scan, title=report["title"])
                file_path = get_report_file_path(regen["file_name"])
        else:
            regen = generate_threat_intel_pdf_report(title=report["title"])
            file_path = get_report_file_path(regen["file_name"])

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file is unavailable on disk.",
        )

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=report["file_name"],
    )
