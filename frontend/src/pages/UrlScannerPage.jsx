import React, { useState, useEffect } from 'react';
import {
  Search,
  Shield,
  Cpu,
  Globe,
  Server,
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  FileDown,
  Loader2,
  Link2,
  Sliders,
} from 'lucide-react';
import { phishguardApi, extractErrorMessage } from '../services/api';
import {
  ClassificationBadge,
  ErrorBanner,
  ProviderStatusBadge,
  SeverityBadge,
  UnavailableNotice,
} from '../components/StatusBadges';
import { formatDateTime, getRiskColor, validateClientUrl } from '../utils/formatters';

const SCAN_STEPS = [
  'Validating URL syntax & enforcing SSRF protection',
  'Extracting 28 lexical & structural URL features',
  'Running Calibrated Random Forest ML classifier',
  'Querying VirusTotal, URLhaus & AbuseIPDB threat feeds',
  'Correlating evidence & computing explainable risk score',
];

export function UrlScannerPage({
  initialResult = null,
  onScanComplete,
  onOpenCorrelation,
}) {
  const [urlInput, setUrlInput] = useState(initialResult?.url || '');
  const [resolveDns, setResolveDns] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [error, setError] = useState('');
  const [result, setResult] = useState(initialResult);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (initialResult) {
      setResult(initialResult);
      setUrlInput(initialResult.url || '');
    }
  }, [initialResult]);

  const handleScan = async (e, overrideUrl = null) => {
    if (e) e.preventDefault();
    const target = (overrideUrl ?? urlInput).trim();
    const validationErr = validateClientUrl(target);
    if (validationErr) {
      setError(validationErr);
      return;
    }

    setError('');
    setLoading(true);
    setActiveStep(0);

    // Real progressive step indicator while awaiting backend pipeline
    const timers = [
      setTimeout(() => setActiveStep(1), 220),
      setTimeout(() => setActiveStep(2), 520),
      setTimeout(() => setActiveStep(3), 850),
      setTimeout(() => setActiveStep(4), 1200),
    ];

    try {
      const scanResult = await phishguardApi.scanUrl(target, resolveDns);
      setResult(scanResult);
      if (onScanComplete) onScanComplete(scanResult);
    } catch (err) {
      setError(extractErrorMessage(err, 'URL scan failed. Please check the URL and retry.'));
    } finally {
      timers.forEach(clearTimeout);
      setLoading(false);
      setActiveStep(-1);
    }
  };

  const handleDownloadPdf = async () => {
    if (!result?.id) return;
    setDownloadingPdf(true);
    try {
      const report = await phishguardApi.generateReport({
        report_type: 'url_scan',
        scan_id: result.id,
      });
      window.open(phishguardApi.getReportDownloadUrl(report.id), '_blank');
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to generate scan PDF report.'));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const riskColors = result ? getRiskColor(result.risk_score) : null;
  const unavailableSources = result?.correlation?.unavailable_sources || [];

  return (
    <div className="space-y-5">
      {/* Scanner Input Card */}
      <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#1877F2]" />
              Analyze Suspicious URL
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              URLs are analyzed statically without opening or fetching suspicious pages.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={resolveDns}
              onChange={(e) => setResolveDns(e.target.checked)}
              className="rounded border-slate-300 text-[#1877F2] focus:ring-[#1877F2]"
            />
            Resolve DNS for IP Reputation (AbuseIPDB)
          </label>
        </div>

        <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              if (error) setError('');
            }}
            placeholder="https://example.com/verify/account"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/25 focus:border-[#1877F2]"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning URL...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Scan URL
              </>
            )}
          </button>
        </form>

        {/* Quick examples */}
        <div className="flex flex-wrap items-center gap-2 mt-3.5 text-xs">
          <span className="text-slate-500 font-medium">Test examples:</span>
          {[
            'https://github.com',
            'http://login-security.xyz',
            'http://paypal-verify-account.top/signin',
            'https://bit.ly/8xYazQ',
            'http://fake-bank.net',
          ].map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={loading}
              onClick={() => {
                setUrlInput(ex);
                handleScan(null, ex);
              }}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-[#1877F2] transition-colors font-mono text-[11px]"
            >
              {ex}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} onDismiss={() => setError('')} />
          </div>
        )}

        {/* Live Scan Progress Stepper */}
        {loading && (
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-[#1877F2]">
              <span>Executing Threat Analysis Pipeline...</span>
              <span>
                Step {Math.min(activeStep + 1, SCAN_STEPS.length)} of {SCAN_STEPS.length}
              </span>
            </div>
            <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1877F2] transition-all duration-300"
                style={{ width: `${((activeStep + 1) / SCAN_STEPS.length) * 100}%` }}
              />
            </div>
            <ul className="space-y-1.5 pt-1">
              {SCAN_STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-2 text-xs">
                  {i < activeStep ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : i === activeStep ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#1877F2] animate-spin shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                  )}
                  <span
                    className={
                      i <= activeStep ? 'text-slate-800 font-medium' : 'text-slate-400'
                    }
                  >
                    {step}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Scan Result Output */}
      {result && !loading && (
        <div className="space-y-5">
          <UnavailableNotice providers={unavailableSources} />

          {/* Verdict Overview Card */}
          <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-lg font-extrabold text-slate-900">Threat Verdict</h3>
                  <ClassificationBadge classification={result.classification} size="lg" />
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    {result.threat_category || 'General'}
                  </span>
                </div>
                <p className="text-xs font-mono text-slate-600 mt-2 break-all">
                  {result.normalized_url}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Scanned: {formatDateTime(result.scanned_at)} · Source: {result.detection_source}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {onOpenCorrelation && (
                  <button
                    onClick={() => onOpenCorrelation(result.normalized_url, result.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 text-xs font-semibold text-[#1877F2] hover:bg-blue-100"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    Deep Correlation
                  </button>
                )}
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1877F2] text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {downloadingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5" />
                  )}
                  Download PDF
                </button>
              </div>
            </div>

            {/* 4 Verdict Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              {/* Risk Score */}
              <div className={`rounded-xl border p-4 ${riskColors.light} ${riskColors.border}`}>
                <p className="text-xs font-semibold text-slate-600">Combined Risk Score</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={`text-3xl font-extrabold ${riskColors.text}`}>
                    {result.risk_score}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">/ 100</span>
                </div>
                <div className="w-full h-2 bg-white/80 rounded-full overflow-hidden mt-2.5 border border-slate-200/60">
                  <div
                    className={`h-full ${riskColors.bg}`}
                    style={{ width: `${result.risk_score}%` }}
                  />
                </div>
              </div>

              {/* ML Prediction */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#1877F2]" />
                  ML Prediction
                </p>
                <p className="text-xl font-extrabold text-slate-900 mt-1 capitalize">
                  {result.ml_prediction}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Calibrated Confidence:{' '}
                  <span className="font-bold text-slate-800">
                    {(Number(result.ml_confidence || 0) * 100).toFixed(1)}%
                  </span>
                </p>
              </div>

              {/* Domain Reputation */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#1877F2]" />
                  Domain
                </p>
                <p className="text-sm font-bold text-slate-900 mt-1.5 break-all">{result.domain}</p>
                <p className="text-xs text-slate-500 mt-1">
                  HTTPS: {result.extracted_features?.has_https ? 'Yes' : 'No (Plain HTTP)'}
                </p>
              </div>

              {/* IP Reputation */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-[#1877F2]" />
                  IP Address & Reputation
                </p>
                <p className="text-sm font-bold font-mono text-slate-900 mt-1.5">
                  {result.ip_address || 'Unresolved'}
                </p>
                <p className="text-xs text-slate-500 mt-1 truncate">
                  {result.abuseipdb_result?.status === 'ok'
                    ? `Abuse Confidence: ${result.abuseipdb_result.confidence_score ?? 0}%`
                    : result.dns_note || 'AbuseIPDB not configured'}
                </p>
              </div>
            </div>
          </section>

          {/* Threat Intelligence Provider Results */}
          <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
            <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-[#1877F2]" />
              External Threat Intelligence Findings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { name: 'VirusTotal', data: result.virustotal_result },
                { name: 'URLhaus', data: result.urlhaus_result },
                { name: 'AbuseIPDB', data: result.abuseipdb_result },
              ].map(({ name, data }) => (
                <div
                  key={name}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">{name}</span>
                    <ProviderStatusBadge status={data?.status || 'not_configured'} />
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {data?.message || 'No provider response.'}
                  </p>
                  {data?.status === 'ok' && (
                    <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-semibold">
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                        Malicious: {data.malicious_count ?? 0}
                      </span>
                      {data.total_engines > 0 && (
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                          Engines: {data.total_engines}
                        </span>
                      )}
                      {data.confidence_score !== null && data.confidence_score !== undefined && (
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                          Confidence: {data.confidence_score}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Detection Reasons & Security Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
              <h3 className="text-[15px] font-bold text-slate-900 mb-3.5">Detection Reasons</h3>
              <ul className="space-y-2">
                {(result.detection_reasons || []).map((reason, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-xs text-slate-700 rounded-xl bg-slate-50 border border-slate-100 p-3"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{reason}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
              <h3 className="text-[15px] font-bold text-slate-900 mb-3.5">
                Security Recommendations
              </h3>
              <ul className="space-y-2">
                {(result.recommendations || []).map((rec, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-xs text-slate-700 rounded-xl bg-blue-50/50 border border-blue-100 p-3"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#1877F2] shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Extracted URL Features & Signals */}
          <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
            <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-[#1877F2]" />
              Extracted URL Feature Signals & Lexical Vector
            </h3>

            {(result.feature_signals || []).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                {result.feature_signals.map((sig, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-200 p-3.5 flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {sig.feature}{' '}
                        <span className="font-mono font-medium text-[#1877F2]">({sig.value})</span>
                      </p>
                      <p className="text-xs text-slate-600 mt-1">{sig.description}</p>
                    </div>
                    <SeverityBadge severity={sig.severity} />
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {Object.entries(result.extracted_features || {}).map(([key, val]) => (
                <div
                  key={key}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2"
                >
                  <p className="text-[10px] font-medium text-slate-500 truncate" title={key}>
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                    {typeof val === 'number' && !Number.isInteger(val) ? val.toFixed(2) : val}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
