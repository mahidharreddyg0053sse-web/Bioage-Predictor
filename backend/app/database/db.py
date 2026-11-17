"""
Dual-mode Database Repository for PhishGuard.
Uses Supabase PostgreSQL (via PostgREST with service_role key) when SUPABASE_URL
and SUPABASE_SERVICE_ROLE_KEY are configured; otherwise uses local SQLite with
the exact same 6-table schema so the application works end-to-end out of the box.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.config import get_settings


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_dumps(value: Any) -> str:
    return json.dumps(value if value is not None else {})


def _json_loads(value: Any, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL DEFAULT 'Security Analyst',
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'SOC Analyst',
    organization TEXT DEFAULT 'PhishGuard Security Operations',
    preferences TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_history (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    domain TEXT NOT NULL,
    ip_address TEXT,
    classification TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    ml_prediction TEXT NOT NULL,
    ml_confidence REAL NOT NULL,
    detection_source TEXT NOT NULL,
    threat_category TEXT NOT NULL DEFAULT 'None',
    extracted_features TEXT NOT NULL DEFAULT '{}',
    virustotal_result TEXT NOT NULL DEFAULT '{}',
    urlhaus_result TEXT NOT NULL DEFAULT '{}',
    abuseipdb_result TEXT NOT NULL DEFAULT '{}',
    detection_reasons TEXT NOT NULL DEFAULT '[]',
    recommendations TEXT NOT NULL DEFAULT '[]',
    scanned_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_history_scanned_at ON scan_history(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_history_classification ON scan_history(classification);
CREATE INDEX IF NOT EXISTS idx_scan_history_domain ON scan_history(domain);

CREATE TABLE IF NOT EXISTS threat_indicators (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    indicator_type TEXT NOT NULL,
    indicator_value TEXT NOT NULL,
    canonical_key TEXT NOT NULL,
    threat_category TEXT NOT NULL DEFAULT 'Phishing',
    source TEXT NOT NULL,
    confidence_score INTEGER,
    reputation TEXT NOT NULL DEFAULT 'Unknown',
    raw_metadata TEXT NOT NULL DEFAULT '{}',
    first_seen TEXT NOT NULL,
    last_checked TEXT NOT NULL,
    UNIQUE(canonical_key, source)
);

CREATE INDEX IF NOT EXISTS idx_ti_type_value ON threat_indicators(indicator_type, indicator_value);
CREATE INDEX IF NOT EXISTS idx_ti_canonical ON threat_indicators(canonical_key);

CREATE TABLE IF NOT EXISTS threat_correlations (
    id TEXT PRIMARY KEY,
    scan_id TEXT,
    user_id TEXT,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    ip_address TEXT,
    ml_prediction TEXT NOT NULL,
    ml_confidence REAL NOT NULL,
    external_matches TEXT NOT NULL DEFAULT '[]',
    duplicate_indicators TEXT NOT NULL DEFAULT '[]',
    matching_sources_count INTEGER NOT NULL DEFAULT 0,
    independent_evidence_count INTEGER NOT NULL DEFAULT 0,
    unavailable_sources TEXT NOT NULL DEFAULT '[]',
    correlation_status TEXT NOT NULL,
    combined_risk_score INTEGER NOT NULL,
    final_classification TEXT NOT NULL,
    score_breakdown TEXT NOT NULL DEFAULT '{}',
    investigation_summary TEXT NOT NULL,
    correlated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_corr_scan_id ON threat_correlations(scan_id);
CREATE INDEX IF NOT EXISTS idx_corr_time ON threat_correlations(correlated_at DESC);

CREATE TABLE IF NOT EXISTS generated_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    scan_id TEXT,
    title TEXT NOT NULL,
    report_type TEXT NOT NULL,
    format TEXT NOT NULL,
    summary TEXT,
    file_name TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_integrations (
    id TEXT PRIMARY KEY,
    provider_name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    is_configured INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'not_configured',
    total_queries INTEGER NOT NULL DEFAULT 0,
    total_matches INTEGER NOT NULL DEFAULT 0,
    last_checked_at TEXT,
    last_error TEXT,
    updated_at TEXT NOT NULL
);
"""


class DatabaseRepository:
    """Unified repository for Supabase PostgreSQL and local SQLite."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.db_path = Path(self.settings.sqlite_db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._supabase_healthy = False
        self._last_supabase_error: Optional[str] = None
        self._init_sqlite()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_sqlite(self) -> None:
        with self._connect() as conn:
            conn.executescript(SQLITE_SCHEMA)
            # Ensure default analyst profile exists
            cur = conn.execute("SELECT id FROM profiles LIMIT 1")
            if not cur.fetchone():
                now = utc_now_iso()
                default_prefs = {
                    "auto_correlate": True,
                    "risk_alert_threshold": 70,
                    "default_page_size": 10,
                    "enable_dns_resolution": True,
                }
                conn.execute(
                    """
                    INSERT INTO profiles (id, full_name, email, role, organization, preferences, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(uuid.uuid4()),
                        "Security Analyst",
                        "analyst@phishguard.local",
                        "Lead SOC Analyst",
                        "PhishGuard Security Operations",
                        _json_dumps(default_prefs),
                        now,
                        now,
                    ),
                )
            # Ensure default api_integrations rows exist
            providers = [
                ("virustotal", "VirusTotal", self.settings.virustotal_configured),
                ("urlhaus", "URLhaus", self.settings.urlhaus_configured),
                ("abuseipdb", "AbuseIPDB", self.settings.abuseipdb_configured),
            ]
            now = utc_now_iso()
            for pname, dname, configured in providers:
                status_val = "connected" if configured else "not_configured"
                cur = conn.execute("SELECT id FROM api_integrations WHERE provider_name = ?", (pname,))
                if not cur.fetchone():
                    conn.execute(
                        """
                        INSERT INTO api_integrations
                        (id, provider_name, display_name, is_configured, status, total_queries, total_matches, updated_at)
                        VALUES (?, ?, ?, ?, ?, 0, 0, ?)
                        """,
                        (str(uuid.uuid4()), pname, dname, 1 if configured else 0, status_val, now),
                    )
                else:
                    conn.execute(
                        """
                        UPDATE api_integrations
                        SET is_configured = ?, status = CASE WHEN ? = 0 THEN 'not_configured' ELSE status END, updated_at = ?
                        WHERE provider_name = ?
                        """,
                        (1 if configured else 0, 1 if configured else 0, now, pname),
                    )
            conn.commit()

    # ------------------------------------------------------------------
    # Optional Supabase Sync (non-blocking helper when configured)
    # ------------------------------------------------------------------
    def _supabase_headers(self) -> Dict[str, str]:
        key = self.settings.supabase_service_role_key.strip()
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

    def _sync_to_supabase(self, table: str, payload: Dict[str, Any]) -> None:
        if not self.settings.supabase_configured:
            return
        url = f"{self.settings.supabase_url.rstrip('/')}/rest/v1/{table}"
        try:
            with httpx.Client(timeout=4.0) as client:
                resp = client.post(url, headers=self._supabase_headers(), json=payload)
                if resp.status_code < 300:
                    self._supabase_healthy = True
                    self._last_supabase_error = None
                else:
                    self._supabase_healthy = False
                    self._last_supabase_error = f"HTTP {resp.status_code}"
        except Exception as exc:
            self._supabase_healthy = False
            self._last_supabase_error = exc.__class__.__name__

    def check_connection_status(self) -> Dict[str, Any]:
        if self.settings.supabase_configured:
            url = f"{self.settings.supabase_url.rstrip('/')}/rest/v1/scan_history?select=id&limit=1"
            try:
                with httpx.Client(timeout=4.0) as client:
                    resp = client.get(url, headers=self._supabase_headers())
                if resp.status_code < 300:
                    self._supabase_healthy = True
                    self._last_supabase_error = None
                    return {
                        "engine": "Supabase PostgreSQL",
                        "connected": True,
                        "status": "connected",
                        "supabase_configured": True,
                        "message": "Connected to Supabase PostgreSQL.",
                    }
                self._supabase_healthy = False
                self._last_supabase_error = f"HTTP {resp.status_code}"
                return {
                    "engine": "Supabase PostgreSQL (Local SQLite Fallback Active)",
                    "connected": True,
                    "status": "degraded",
                    "supabase_configured": True,
                    "message": f"Supabase returned HTTP {resp.status_code}; using local SQLite mirror.",
                }
            except Exception as exc:
                self._supabase_healthy = False
                self._last_supabase_error = str(exc)
                return {
                    "engine": "Supabase PostgreSQL (Local SQLite Fallback Active)",
                    "connected": True,
                    "status": "degraded",
                    "supabase_configured": True,
                    "message": f"Supabase unreachable ({exc.__class__.__name__}); using local SQLite mirror.",
                }
        return {
            "engine": "Local SQLite (Supabase-Compatible Schema)",
            "connected": True,
            "status": "local_fallback",
            "supabase_configured": False,
            "message": "Supabase credentials not set in .env; running on local SQLite database with identical schema.",
        }

    # ------------------------------------------------------------------
    # Profiles
    # ------------------------------------------------------------------
    def get_profile(self) -> Dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM profiles LIMIT 1").fetchone()
            if not row:
                self._init_sqlite()
                row = conn.execute("SELECT * FROM profiles LIMIT 1").fetchone()
            return {
                "id": row["id"],
                "full_name": row["full_name"],
                "email": row["email"],
                "role": row["role"],
                "organization": row["organization"],
                "preferences": _json_loads(row["preferences"], {}),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }

    def update_profile(self, full_name: str, email: str, role: str, organization: str) -> Dict[str, Any]:
        profile = self.get_profile()
        now = utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE profiles
                SET full_name = ?, email = ?, role = ?, organization = ?, updated_at = ?
                WHERE id = ?
                """,
                (full_name, email, role, organization, now, profile["id"]),
            )
            conn.commit()
        return self.get_profile()

    def update_preferences(self, prefs: Dict[str, Any]) -> Dict[str, Any]:
        profile = self.get_profile()
        merged = {**profile.get("preferences", {}), **prefs}
        now = utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                "UPDATE profiles SET preferences = ?, updated_at = ? WHERE id = ?",
                (_json_dumps(merged), now, profile["id"]),
            )
            conn.commit()
        return self.get_profile()

    # ------------------------------------------------------------------
    # Scan History
    # ------------------------------------------------------------------
    def _deserialize_scan(self, row: sqlite3.Row) -> Dict[str, Any]:
        return {
            "id": row["id"],
            "user_id": row["user_id"],
            "url": row["url"],
            "normalized_url": row["normalized_url"],
            "domain": row["domain"],
            "ip_address": row["ip_address"],
            "classification": row["classification"],
            "risk_score": int(row["risk_score"]),
            "ml_prediction": row["ml_prediction"],
            "ml_confidence": float(row["ml_confidence"]),
            "detection_source": row["detection_source"],
            "threat_category": row["threat_category"],
            "extracted_features": _json_loads(row["extracted_features"], {}),
            "virustotal_result": _json_loads(row["virustotal_result"], {}),
            "urlhaus_result": _json_loads(row["urlhaus_result"], {}),
            "abuseipdb_result": _json_loads(row["abuseipdb_result"], {}),
            "detection_reasons": _json_loads(row["detection_reasons"], []),
            "recommendations": _json_loads(row["recommendations"], []),
            "scanned_at": row["scanned_at"],
        }

    def save_scan(self, record: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = record.get("id") or str(uuid.uuid4())
        scanned_at = record.get("scanned_at") or utc_now_iso()
        profile = self.get_profile()
        user_id = record.get("user_id") or profile["id"]

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO scan_history (
                    id, user_id, url, normalized_url, domain, ip_address,
                    classification, risk_score, ml_prediction, ml_confidence,
                    detection_source, threat_category, extracted_features,
                    virustotal_result, urlhaus_result, abuseipdb_result,
                    detection_reasons, recommendations, scanned_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    scan_id,
                    user_id,
                    record["url"],
                    record["normalized_url"],
                    record["domain"],
                    record.get("ip_address"),
                    record["classification"],
                    int(record["risk_score"]),
                    record["ml_prediction"],
                    float(record["ml_confidence"]),
                    record["detection_source"],
                    record.get("threat_category", "None"),
                    _json_dumps(record.get("extracted_features", {})),
                    _json_dumps(record.get("virustotal_result", {})),
                    _json_dumps(record.get("urlhaus_result", {})),
                    _json_dumps(record.get("abuseipdb_result", {})),
                    _json_dumps(record.get("detection_reasons", [])),
                    _json_dumps(record.get("recommendations", [])),
                    scanned_at,
                ),
            )
            conn.commit()

        self._sync_to_supabase(
            "scan_history",
            {
                "id": scan_id,
                "url": record["url"],
                "normalized_url": record["normalized_url"],
                "domain": record["domain"],
                "ip_address": record.get("ip_address"),
                "classification": record["classification"],
                "risk_score": int(record["risk_score"]),
                "ml_prediction": record["ml_prediction"],
                "ml_confidence": float(record["ml_confidence"]),
                "detection_source": record["detection_source"],
                "threat_category": record.get("threat_category", "None"),
                "extracted_features": record.get("extracted_features", {}),
                "virustotal_result": record.get("virustotal_result", {}),
                "urlhaus_result": record.get("urlhaus_result", {}),
                "abuseipdb_result": record.get("abuseipdb_result", {}),
                "detection_reasons": record.get("detection_reasons", []),
                "recommendations": record.get("recommendations", []),
                "scanned_at": scanned_at,
            },
        )
        return self.get_scan_by_id(scan_id) or record

    def get_scan_by_id(self, scan_id: str) -> Optional[Dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM scan_history WHERE id = ?", (scan_id,)).fetchone()
            return self._deserialize_scan(row) if row else None

    def delete_scan(self, scan_id: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM scan_history WHERE id = ?", (scan_id,))
            conn.execute("DELETE FROM threat_correlations WHERE scan_id = ?", (scan_id,))
            conn.commit()
            return cur.rowcount > 0

    def list_scans(
        self,
        *,
        search: str = "",
        classification: str = "",
        min_risk: Optional[int] = None,
        max_risk: Optional[int] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[List[Dict[str, Any]], int]:
        where_clauses = []
        params: List[Any] = []

        if search.strip():
            like = f"%{search.strip().lower()}%"
            where_clauses.append("(LOWER(url) LIKE ? OR LOWER(domain) LIKE ? OR LOWER(threat_category) LIKE ?)")
            params.extend([like, like, like])
        if classification.strip() and classification.lower() != "all":
            where_clauses.append("LOWER(classification) = ?")
            params.append(classification.strip().lower())
        if min_risk is not None:
            where_clauses.append("risk_score >= ?")
            params.append(min_risk)
        if max_risk is not None:
            where_clauses.append("risk_score <= ?")
            params.append(max_risk)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        offset = max(0, (page - 1) * page_size)

        with self._connect() as conn:
            total = conn.execute(f"SELECT COUNT(*) FROM scan_history {where_sql}", params).fetchone()[0]
            rows = conn.execute(
                f"SELECT * FROM scan_history {where_sql} ORDER BY scanned_at DESC LIMIT ? OFFSET ?",
                [*params, page_size, offset],
            ).fetchall()
            return [self._deserialize_scan(r) for r in rows], int(total)

    def get_all_scans(self, limit: int = 500) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM scan_history ORDER BY scanned_at DESC LIMIT ?", (limit,)
            ).fetchall()
            return [self._deserialize_scan(r) for r in rows]

    def count_scans(self) -> int:
        with self._connect() as conn:
            return int(conn.execute("SELECT COUNT(*) FROM scan_history").fetchone()[0])

    # ------------------------------------------------------------------
    # Threat Indicators (IoCs)
    # ------------------------------------------------------------------
    def _deserialize_indicator(self, row: sqlite3.Row) -> Dict[str, Any]:
        return {
            "id": row["id"],
            "indicator_type": row["indicator_type"],
            "indicator_value": row["indicator_value"],
            "canonical_key": row["canonical_key"],
            "threat_category": row["threat_category"],
            "source": row["source"],
            "confidence_score": row["confidence_score"],
            "reputation": row["reputation"],
            "raw_metadata": _json_loads(row["raw_metadata"], {}),
            "first_seen": row["first_seen"],
            "last_checked": row["last_checked"],
        }

    def upsert_indicator(
        self,
        *,
        indicator_type: str,
        indicator_value: str,
        threat_category: str,
        source: str,
        confidence_score: Optional[int],
        reputation: str,
        raw_metadata: Optional[Dict[str, Any]] = None,
        last_checked: Optional[str] = None,
    ) -> Dict[str, Any]:
        canonical_key = f"{indicator_type.lower()}:{indicator_value.strip().lower().rstrip('/')}"
        now = last_checked or utc_now_iso()
        profile = self.get_profile()

        with self._connect() as conn:
            existing = conn.execute(
                "SELECT id FROM threat_indicators WHERE canonical_key = ? AND source = ?",
                (canonical_key, source),
            ).fetchone()
            if existing:
                ind_id = existing["id"]
                conn.execute(
                    """
                    UPDATE threat_indicators
                    SET threat_category = ?, confidence_score = ?, reputation = ?,
                        raw_metadata = ?, last_checked = ?
                    WHERE id = ?
                    """,
                    (
                        threat_category,
                        confidence_score,
                        reputation,
                        _json_dumps(raw_metadata or {}),
                        now,
                        ind_id,
                    ),
                )
            else:
                ind_id = str(uuid.uuid4())
                conn.execute(
                    """
                    INSERT INTO threat_indicators (
                        id, user_id, indicator_type, indicator_value, canonical_key,
                        threat_category, source, confidence_score, reputation,
                        raw_metadata, first_seen, last_checked
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        ind_id,
                        profile["id"],
                        indicator_type.lower(),
                        indicator_value.strip(),
                        canonical_key,
                        threat_category,
                        source,
                        confidence_score,
                        reputation,
                        _json_dumps(raw_metadata or {}),
                        now,
                        now,
                    ),
                )
            conn.commit()
            row = conn.execute("SELECT * FROM threat_indicators WHERE id = ?", (ind_id,)).fetchone()
            return self._deserialize_indicator(row)

    def find_matching_indicators(
        self, normalized_url: str, domain: str, ip_address: Optional[str]
    ) -> List[Dict[str, Any]]:
        keys = [
            f"url:{normalized_url.strip().lower().rstrip('/')}",
            f"domain:{domain.strip().lower().rstrip('.')}",
        ]
        if ip_address:
            keys.append(f"ip:{ip_address.strip().lower()}")

        placeholders = ",".join("?" for _ in keys)
        with self._connect() as conn:
            rows = conn.execute(
                f"SELECT * FROM threat_indicators WHERE canonical_key IN ({placeholders}) ORDER BY last_checked DESC",
                keys,
            ).fetchall()
            return [self._deserialize_indicator(r) for r in rows]

    def list_indicators(
        self,
        *,
        search: str = "",
        indicator_type: str = "",
        source: str = "",
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        clauses = []
        params: List[Any] = []
        if search.strip():
            like = f"%{search.strip().lower()}%"
            clauses.append("(LOWER(indicator_value) LIKE ? OR LOWER(threat_category) LIKE ? OR LOWER(source) LIKE ?)")
            params.extend([like, like, like])
        if indicator_type.strip() and indicator_type.lower() != "all":
            clauses.append("LOWER(indicator_type) = ?")
            params.append(indicator_type.strip().lower())
        if source.strip() and source.lower() != "all":
            clauses.append("LOWER(source) = ?")
            params.append(source.strip().lower())

        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        with self._connect() as conn:
            rows = conn.execute(
                f"SELECT * FROM threat_indicators {where_sql} ORDER BY last_checked DESC LIMIT ?",
                [*params, limit],
            ).fetchall()
            return [self._deserialize_indicator(r) for r in rows]

    # ------------------------------------------------------------------
    # Threat Correlations
    # ------------------------------------------------------------------
    def _deserialize_correlation(self, row: sqlite3.Row) -> Dict[str, Any]:
        return {
            "id": row["id"],
            "scan_id": row["scan_id"],
            "url": row["url"],
            "domain": row["domain"],
            "ip_address": row["ip_address"],
            "ml_prediction": row["ml_prediction"],
            "ml_confidence": float(row["ml_confidence"]),
            "external_matches": _json_loads(row["external_matches"], []),
            "duplicate_indicators": _json_loads(row["duplicate_indicators"], []),
            "matching_sources_count": int(row["matching_sources_count"]),
            "independent_evidence_count": int(row["independent_evidence_count"]),
            "unavailable_sources": _json_loads(row["unavailable_sources"], []),
            "correlation_status": row["correlation_status"],
            "combined_risk_score": int(row["combined_risk_score"]),
            "final_classification": row["final_classification"],
            "score_breakdown": _json_loads(row["score_breakdown"], {}),
            "investigation_summary": row["investigation_summary"],
            "correlated_at": row["correlated_at"],
        }

    def save_correlation(self, record: Dict[str, Any]) -> Dict[str, Any]:
        corr_id = record.get("id") or str(uuid.uuid4())
        correlated_at = record.get("correlated_at") or utc_now_iso()
        profile = self.get_profile()

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO threat_correlations (
                    id, scan_id, user_id, url, domain, ip_address,
                    ml_prediction, ml_confidence, external_matches,
                    duplicate_indicators, matching_sources_count,
                    independent_evidence_count, unavailable_sources,
                    correlation_status, combined_risk_score, final_classification,
                    score_breakdown, investigation_summary, correlated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    corr_id,
                    record.get("scan_id"),
                    profile["id"],
                    record["url"],
                    record["domain"],
                    record.get("ip_address"),
                    record["ml_prediction"],
                    float(record["ml_confidence"]),
                    _json_dumps(record.get("external_matches", [])),
                    _json_dumps(record.get("duplicate_indicators", [])),
                    int(record.get("matching_sources_count", 0)),
                    int(record.get("independent_evidence_count", 0)),
                    _json_dumps(record.get("unavailable_sources", [])),
                    record["correlation_status"],
                    int(record["combined_risk_score"]),
                    record["final_classification"],
                    _json_dumps(record.get("score_breakdown", {})),
                    record["investigation_summary"],
                    correlated_at,
                ),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM threat_correlations WHERE id = ?", (corr_id,)).fetchone()
            return self._deserialize_correlation(row)

    def list_correlations(self, limit: int = 30) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM threat_correlations ORDER BY correlated_at DESC LIMIT ?", (limit,)
            ).fetchall()
            return [self._deserialize_correlation(r) for r in rows]

    def get_correlation_by_scan_id(self, scan_id: str) -> Optional[Dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM threat_correlations WHERE scan_id = ? ORDER BY correlated_at DESC LIMIT 1",
                (scan_id,),
            ).fetchone()
            return self._deserialize_correlation(row) if row else None

    # ------------------------------------------------------------------
    # Generated Reports
    # ------------------------------------------------------------------
    def _deserialize_report(self, row: sqlite3.Row) -> Dict[str, Any]:
        return {
            "id": row["id"],
            "scan_id": row["scan_id"],
            "title": row["title"],
            "report_type": row["report_type"],
            "format": row["format"],
            "summary": row["summary"],
            "file_name": row["file_name"],
            "metadata": _json_loads(row["metadata"], {}),
            "created_at": row["created_at"],
        }

    def save_report(self, record: Dict[str, Any]) -> Dict[str, Any]:
        rep_id = record.get("id") or str(uuid.uuid4())
        created_at = record.get("created_at") or utc_now_iso()
        profile = self.get_profile()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO generated_reports (
                    id, user_id, scan_id, title, report_type, format,
                    summary, file_name, metadata, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    rep_id,
                    profile["id"],
                    record.get("scan_id"),
                    record["title"],
                    record["report_type"],
                    record["format"],
                    record.get("summary", ""),
                    record["file_name"],
                    _json_dumps(record.get("metadata", {})),
                    created_at,
                ),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM generated_reports WHERE id = ?", (rep_id,)).fetchone()
            return self._deserialize_report(row)

    def list_reports(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM generated_reports ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
            return [self._deserialize_report(r) for r in rows]

    def get_report_by_id(self, report_id: str) -> Optional[Dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM generated_reports WHERE id = ?", (report_id,)).fetchone()
            return self._deserialize_report(row) if row else None

    # ------------------------------------------------------------------
    # API Integrations Tracking
    # ------------------------------------------------------------------
    def record_integration_query(
        self, provider_name: str, status_str: str, matched: bool = False, error: Optional[str] = None
    ) -> None:
        now = utc_now_iso()
        mapped_status = (
            "connected"
            if status_str == "ok"
            else "not_configured"
            if status_str == "not_configured"
            else "degraded"
            if status_str == "rate_limited"
            else "unavailable"
        )
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE api_integrations
                SET status = ?,
                    total_queries = total_queries + CASE WHEN ? IN ('ok', 'rate_limited', 'unavailable', 'error') THEN 1 ELSE 0 END,
                    total_matches = total_matches + CASE WHEN ? = 1 THEN 1 ELSE 0 END,
                    last_checked_at = ?,
                    last_error = ?,
                    updated_at = ?
                WHERE provider_name = ?
                """,
                (mapped_status, status_str, 1 if matched else 0, now, error, now, provider_name.lower()),
            )
            conn.commit()

    def list_integrations(self) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM api_integrations ORDER BY provider_name ASC").fetchall()
            return [
                {
                    "id": r["id"],
                    "provider_name": r["provider_name"],
                    "display_name": r["display_name"],
                    "is_configured": bool(r["is_configured"]),
                    "status": r["status"],
                    "total_queries": int(r["total_queries"]),
                    "total_matches": int(r["total_matches"]),
                    "last_checked_at": r["last_checked_at"],
                    "last_error": r["last_error"],
                    "updated_at": r["updated_at"],
                }
                for r in rows
            ]


db = DatabaseRepository()
