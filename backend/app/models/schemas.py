"""Pydantic request and response schemas for PhishGuard API."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


ClassificationType = Literal["Safe", "Suspicious", "Phishing", "Malicious"]


class ScanRequest(BaseModel):
    url: str = Field(..., min_length=3, max_length=2048, description="Target URL to analyze")
    resolve_dns: bool = Field(default=True, description="Whether to safely resolve domain IP for IP reputation checks")


class FeaturesRequest(BaseModel):
    url: str = Field(..., min_length=3, max_length=2048, description="Target URL for feature extraction")


class ThreatIntelProviderResult(BaseModel):
    provider: str
    status: Literal["ok", "not_configured", "unavailable", "error", "rate_limited", "skipped"]
    indicator_type: Optional[str] = None
    indicator_value: Optional[str] = None
    matched: bool = False
    malicious_count: int = 0
    suspicious_count: int = 0
    total_engines: int = 0
    reputation_score: Optional[int] = None
    confidence_score: Optional[int] = None
    threat_category: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    details: Dict[str, Any] = Field(default_factory=dict)
    message: str = ""
    checked_at: str = ""


class CorrelationEvidenceItem(BaseModel):
    indicator_type: str
    indicator_value: str
    canonical_key: str
    source: str
    threat_category: str
    severity: str
    confidence: Optional[int] = None
    is_duplicate: bool = False
    duplicate_of_source: Optional[str] = None
    summary: str


class CorrelationRequest(BaseModel):
    url: str = Field(..., min_length=3, max_length=2048)
    scan_id: Optional[str] = None
    resolve_dns: bool = True


class CorrelationResponse(BaseModel):
    id: str
    scan_id: Optional[str] = None
    url: str
    domain: str
    ip_address: Optional[str] = None
    ml_prediction: str
    ml_confidence: float
    ml_phishing_probability: float
    external_matches: List[CorrelationEvidenceItem]
    duplicate_indicators: List[CorrelationEvidenceItem]
    matching_sources_count: int
    independent_evidence_count: int
    available_sources: List[str]
    unavailable_sources: List[Dict[str, str]]
    correlation_status: str
    combined_risk_score: int
    final_classification: ClassificationType
    score_breakdown: Dict[str, Any]
    detection_reasons: List[str]
    recommendations: List[str]
    investigation_summary: str
    provider_results: Dict[str, ThreatIntelProviderResult]
    correlated_at: str


class ScanResponse(BaseModel):
    id: str
    url: str
    normalized_url: str
    domain: str
    ip_address: Optional[str] = None
    classification: ClassificationType
    risk_score: int
    ml_prediction: str
    ml_confidence: float
    ml_phishing_probability: float
    detection_source: str
    threat_category: str
    extracted_features: Dict[str, Any]
    feature_signals: List[Dict[str, Any]]
    virustotal_result: Dict[str, Any]
    urlhaus_result: Dict[str, Any]
    abuseipdb_result: Dict[str, Any]
    correlation: Dict[str, Any]
    detection_reasons: List[str]
    recommendations: List[str]
    scanned_at: str


class IndicatorCreateRequest(BaseModel):
    indicator_type: Literal["url", "domain", "ip", "hash"]
    indicator_value: str = Field(..., min_length=2, max_length=2048)
    threat_category: str = Field(default="Phishing", max_length=100)
    source: str = Field(default="Analyst Submission", max_length=100)
    confidence_score: int = Field(default=75, ge=0, le=100)
    reputation: str = Field(default="Suspicious", max_length=60)


class ReportGenerateRequest(BaseModel):
    report_type: Literal["url_scan", "threat_intelligence", "analytics_summary"]
    scan_id: Optional[str] = None
    title: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., min_length=5, max_length=200)
    role: str = Field(..., min_length=2, max_length=80)
    organization: str = Field(default="PhishGuard Security Operations", max_length=150)


class PreferencesUpdateRequest(BaseModel):
    auto_correlate: bool = True
    risk_alert_threshold: int = Field(default=70, ge=10, le=100)
    default_page_size: int = Field(default=10, ge=5, le=50)
    enable_dns_resolution: bool = True
