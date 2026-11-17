-- =============================================================================
-- PhishGuard: AI-Based Phishing URL & Threat Intelligence Correlation System
-- Supabase PostgreSQL Database Schema & Row Level Security (RLS) Policies
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. profiles: Security analyst user profiles & application preferences
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT 'Security Analyst',
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'SOC Analyst',
    organization TEXT DEFAULT 'PhishGuard Security Operations',
    preferences JSONB NOT NULL DEFAULT '{
        "auto_correlate": true,
        "risk_alert_threshold": 70,
        "default_page_size": 10,
        "enable_dns_resolution": true
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. scan_history: All URL scans, ML predictions, extracted features & verdicts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scan_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    domain TEXT NOT NULL,
    ip_address TEXT,
    classification TEXT NOT NULL CHECK (classification IN ('Safe', 'Suspicious', 'Phishing', 'Malicious')),
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    ml_prediction TEXT NOT NULL CHECK (ml_prediction IN ('legitimate', 'phishing')),
    ml_confidence NUMERIC(5,4) NOT NULL CHECK (ml_confidence >= 0 AND ml_confidence <= 1),
    detection_source TEXT NOT NULL DEFAULT 'ML + Threat Correlation',
    threat_category TEXT NOT NULL DEFAULT 'None',
    extracted_features JSONB NOT NULL DEFAULT '{}'::jsonb,
    virustotal_result JSONB NOT NULL DEFAULT '{}'::jsonb,
    urlhaus_result JSONB NOT NULL DEFAULT '{}'::jsonb,
    abuseipdb_result JSONB NOT NULL DEFAULT '{}'::jsonb,
    detection_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_history_scanned_at ON public.scan_history (scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_history_classification ON public.scan_history (classification);
CREATE INDEX IF NOT EXISTS idx_scan_history_domain ON public.scan_history (domain);
CREATE INDEX IF NOT EXISTS idx_scan_history_user_id ON public.scan_history (user_id);

-- -----------------------------------------------------------------------------
-- 3. threat_indicators: Normalized IoCs collected from TI sources & scans
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.threat_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    indicator_type TEXT NOT NULL CHECK (indicator_type IN ('url', 'domain', 'ip', 'hash')),
    indicator_value TEXT NOT NULL,
    canonical_key TEXT NOT NULL,
    threat_category TEXT NOT NULL DEFAULT 'Phishing',
    source TEXT NOT NULL,
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    reputation TEXT NOT NULL DEFAULT 'Unknown',
    raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (canonical_key, source)
);

CREATE INDEX IF NOT EXISTS idx_threat_indicators_type_value ON public.threat_indicators (indicator_type, indicator_value);
CREATE INDEX IF NOT EXISTS idx_threat_indicators_source ON public.threat_indicators (source);
CREATE INDEX IF NOT EXISTS idx_threat_indicators_last_checked ON public.threat_indicators (last_checked DESC);

-- -----------------------------------------------------------------------------
-- 4. threat_correlations: Deduplicated ML + Threat Intelligence correlation records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.threat_correlations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID REFERENCES public.scan_history(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    ip_address TEXT,
    ml_prediction TEXT NOT NULL,
    ml_confidence NUMERIC(5,4) NOT NULL,
    external_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
    duplicate_indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
    matching_sources_count INTEGER NOT NULL DEFAULT 0,
    independent_evidence_count INTEGER NOT NULL DEFAULT 0,
    unavailable_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    correlation_status TEXT NOT NULL,
    combined_risk_score INTEGER NOT NULL CHECK (combined_risk_score >= 0 AND combined_risk_score <= 100),
    final_classification TEXT NOT NULL CHECK (final_classification IN ('Safe', 'Suspicious', 'Phishing', 'Malicious')),
    score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    investigation_summary TEXT NOT NULL,
    correlated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threat_correlations_scan_id ON public.threat_correlations (scan_id);
CREATE INDEX IF NOT EXISTS idx_threat_correlations_correlated_at ON public.threat_correlations (correlated_at DESC);

-- -----------------------------------------------------------------------------
-- 5. generated_reports: Saved PDF & CSV security report metadata
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    scan_id UUID REFERENCES public.scan_history(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('url_scan', 'threat_intelligence', 'analytics_summary', 'csv_export')),
    format TEXT NOT NULL CHECK (format IN ('pdf', 'csv')),
    summary TEXT,
    file_name TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_created_at ON public.generated_reports (created_at DESC);

-- -----------------------------------------------------------------------------
-- 6. api_integrations: External Threat Intelligence provider health & stats
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    is_configured BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'not_configured' CHECK (status IN ('connected', 'degraded', 'unavailable', 'not_configured')),
    total_queries INTEGER NOT NULL DEFAULT 0,
    total_matches INTEGER NOT NULL DEFAULT 0,
    last_checked_at TIMESTAMPTZ,
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default integration records
INSERT INTO public.api_integrations (provider_name, display_name, is_configured, status)
VALUES
    ('virustotal', 'VirusTotal', FALSE, 'not_configured'),
    ('urlhaus', 'URLhaus', FALSE, 'not_configured'),
    ('abuseipdb', 'AbuseIPDB', FALSE, 'not_configured')
ON CONFLICT (provider_name) DO NOTHING;

-- =============================================================================
-- Row Level Security (RLS) Policies
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threat_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threat_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only view and update their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = auth_user_id);

-- Scan History: Users can manage their own scans
CREATE POLICY "Users can view own scan history"
    ON public.scan_history FOR SELECT
    USING (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can insert own scans"
    ON public.scan_history FOR INSERT
    WITH CHECK (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can delete own scans"
    ON public.scan_history FOR DELETE
    USING (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

-- Threat Indicators: Authenticated analysts can read shared IoCs and insert own
CREATE POLICY "Authenticated users can view threat indicators"
    ON public.threat_indicators FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert threat indicators"
    ON public.threat_indicators FOR INSERT
    WITH CHECK (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

-- Threat Correlations: Scoped to owning analyst
CREATE POLICY "Users can view own correlations"
    ON public.threat_correlations FOR SELECT
    USING (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can insert own correlations"
    ON public.threat_correlations FOR INSERT
    WITH CHECK (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

-- Generated Reports: Scoped to owning analyst
CREATE POLICY "Users can view own reports"
    ON public.generated_reports FOR SELECT
    USING (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can create own reports"
    ON public.generated_reports FOR INSERT
    WITH CHECK (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );

-- API Integrations: Read-only status for authenticated analysts; writes via service_role only
CREATE POLICY "Authenticated users can view integration status"
    ON public.api_integrations FOR SELECT
    USING (auth.role() = 'authenticated');
