import React, { useState, useEffect, useCallback } from 'react';
import {
  GitMerge,
  Search,
  Cpu,
  ShieldAlert,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Layers,
  Info,
  RefreshCw,
} from 'lucide-react';
import { phishguardApi, extractErrorMessage } from '../services/api';
import {
  ClassificationBadge,
  ErrorBanner,
  ProviderStatusBadge,
  UnavailableNotice,
} from '../components/StatusBadges';
import { formatDateTime, getRiskColor, validateClientUrl } from '../utils/formatters';

export function ThreatCorrelationPage({ initialTarget = null }) {
  const [urlInput, setUrlInput] = useState(initialTarget?.url || 'http://login-security.xyz');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await phishguardApi.getCorrelationHistory(20);
      setHistory(res.items || []);
    } catch {
      // Non-fatal
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const runCorrelation = useCallback(
    async (targetUrl, scanId = null) => {
      const validationErr = validateClientUrl(targetUrl);
      if (validationErr) {
        setError(validationErr);
        return;
      }
      setError('');
      setLoading(true);
      try {
        const res = await phishguardApi.correlateThreat(targetUrl.trim(), scanId, true);
        setResult(res);
        loadHistory();
      } catch (err) {
        setError(extractErrorMessage(err, 'Threat correlation failed.'));
      } finally {
        setLoading(false);
      }
    },
    [loadHistory]
  );

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (initialTarget?.url) {
      setUrlInput(initialTarget.url);
      runCorrelation(initialTarget.url, initialTarget.scanId || null);
    }
  }, [initialTarget, runCorrelation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    runCorrelation(urlInput);
  };

  const riskColors = result ? getRiskColor(result.combined_risk_score) : null;
  const breakdown = result?.score_breakdown || {};

  return (
    <div className="space-y-5">
      {/* Correlation Runner */}
      <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-[#1877F2]" />
              Correlate ML Detection with External Threat Intelligence
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Matches URL, domain, and IP indicators across providers, detects duplicate IoC
              reports so they are never double-counted as independent evidence, and calculates an
              explainable combined risk score.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              if (error) setError('');
            }}
            placeholder="Enter URL to correlate (e.g. http://login-security.xyz)"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/25 focus:border-[#1877F2]"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Correlating...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Run Correlation
              </>
            )}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
          <span className="text-slate-500 font-medium">Multi-source test targets:</span>
          {[
            'http://login-security.xyz',
            'http://fake-bank.net',
            'http://malicious-domain.xyz',
            'https://github.com',
          ].map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => {
                setUrlInput(sample);
                runCorrelation(sample);
              }}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-[#1877F2] font-mono text-[11px]"
            >
              {sample}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} onDismiss={() => setError('')} />
          </div>
        )}
      </section>

      {/* Active Correlation Analysis Results */}
      {result && (
        <div className="space-y-5">
          <UnavailableNotice providers={result.unavailable_sources} />

          {/* Top Summary Strip */}
          <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Correlation Assessment
                  </h3>
                  <ClassificationBadge classification={result.final_classification} size="lg" />
                  <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-[#1877F2]">
                    {result.correlation_status}
                  </span>
                </div>
                <p className="text-xs font-mono text-slate-600 mt-1.5 break-all">
                  {result.url} · Domain: {result.domain}{' '}
                  {result.ip_address ? `· IP: ${result.ip_address}` : ''}
                </p>
              </div>
              <span className="text-xs text-slate-400">
                {formatDateTime(result.correlated_at)}
              </span>
            </div>

            {/* 5 Key Correlation KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mt-5">
              <div className={`rounded-xl border p-4 ${riskColors.light} ${riskColors.border}`}>
                <p className="text-xs font-semibold text-slate-600">Combined Risk</p>
                <p className={`text-2xl font-extrabold mt-1 ${riskColors.text}`}>
                  {result.combined_risk_score}
                  <span className="text-xs font-normal text-slate-500">/100</span>
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-[#1877F2]" /> ML Detection
                </p>
                <p className="text-lg font-extrabold text-slate-900 mt-1 capitalize">
                  {result.ml_prediction}
                </p>
                <p className="text-[11px] text-slate-500">
                  {(result.ml_confidence * 100).toFixed(1)}% confidence
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold text-slate-600">Matching Sources</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {result.matching_sources_count}
                </p>
                <p className="text-[11px] text-slate-500">Distinct intel feeds</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <p className="text-xs font-semibold text-slate-700">Independent Evidence</p>
                <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                  {result.independent_evidence_count}
                </p>
                <p className="text-[11px] text-slate-600">Unique IoCs counted</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <p className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Copy className="w-3.5 h-3.5 text-amber-600" /> Duplicates Filtered
                </p>
                <p className="text-2xl font-extrabold text-amber-700 mt-1">
                  {result.duplicate_indicators?.length || 0}
                </p>
                <p className="text-[11px] text-slate-600">Not double-counted</p>
              </div>
            </div>

            {/* Investigation Summary */}
            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
              <p className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#1877F2]" />
                Threat Investigation Summary
              </p>
              <p className="text-xs text-slate-700 leading-relaxed">
                {result.investigation_summary}
              </p>
            </div>
          </section>

          {/* Explainable Risk Score Breakdown & Provider Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
              <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-[#1877F2]" />
                Explainable Risk Score Breakdown
              </h3>
              <div className="space-y-4">
                {[
                  {
                    label: 'Random Forest ML Probability',
                    score: breakdown.ml_score ?? 0,
                    max: breakdown.ml_max ?? 65,
                    color: 'bg-[#1877F2]',
                  },
                  {
                    label: 'Independent External TI Matches',
                    score: breakdown.independent_ti_score ?? 0,
                    max: breakdown.independent_ti_max ?? 30,
                    color: 'bg-red-500',
                  },
                  {
                    label: 'Structural Lexical Heuristics',
                    score: breakdown.structural_heuristics_score ?? 0,
                    max: breakdown.structural_heuristics_max ?? 15,
                    color: 'bg-amber-500',
                  },
                  {
                    label: 'Cross-Source Corroboration Cap (Deduplicated)',
                    score: breakdown.corroboration_bonus ?? 0,
                    max: breakdown.corroboration_max ?? 3,
                    color: 'bg-purple-500',
                  },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{row.label}</span>
                      <span className="font-bold text-slate-900">
                        {row.score} / {row.max} pts
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full ${row.color}`}
                        style={{ width: `${Math.min(100, (row.score / row.max) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-100">
                Duplicate reports excluded from independent weight:{' '}
                <span className="font-bold text-slate-800">
                  {breakdown.deduplicated_reports_excluded ?? 0}
                </span>
              </p>
            </section>

            <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
              <h3 className="text-[15px] font-bold text-slate-900 mb-4">
                Intelligence Source Comparison
              </h3>
              <div className="space-y-3">
                {Object.values(result.provider_results || {}).map((prov) => (
                  <div
                    key={prov.provider}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{prov.provider}</span>
                      <ProviderStatusBadge status={prov.status} />
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5">{prov.message}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Evidence & Deduplication Table */}
          <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
            <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2 mb-3.5">
              <ShieldAlert className="w-4 h-4 text-[#1877F2]" />
              Correlated Threat Indicators & Deduplication Audit
            </h3>

            {(result.external_matches || []).length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-500">
                No external threat indicator matches found for this URL, domain, or IP address.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                      <th className="py-2.5 px-3">Evidence Role</th>
                      <th className="py-2.5 px-3">Indicator</th>
                      <th className="py-2.5 px-3">Source</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Analysis Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {result.external_matches.map((ev, idx) => (
                      <tr
                        key={idx}
                        className={ev.is_duplicate ? 'bg-amber-50/40' : 'hover:bg-slate-50'}
                      >
                        <td className="py-3 px-3 whitespace-nowrap">
                          {ev.is_duplicate ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[11px]">
                              <Copy className="w-3 h-3" /> Duplicate IoC
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3 h-3" /> Independent
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-900">
                          [{ev.indicator_type.toUpperCase()}] {ev.indicator_value}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">{ev.source}</td>
                        <td className="py-3 px-3 text-slate-700">{ev.threat_category}</td>
                        <td className="py-3 px-3 text-slate-600">{ev.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Recent Correlations Audit History */}
      <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-slate-900">Recent Correlation Records</h3>
          <button
            onClick={loadHistory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-2.5 px-3">URL</th>
                <th className="py-2.5 px-3">Classification</th>
                <th className="py-2.5 px-3">Risk</th>
                <th className="py-2.5 px-3">Independent / Dup</th>
                <th className="py-2.5 px-3">Correlation Status</th>
                <th className="py-2.5 px-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {history.slice(0, 10).map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono text-slate-800 max-w-[260px] truncate">
                    {item.url}
                  </td>
                  <td className="py-2.5 px-3">
                    <ClassificationBadge classification={item.final_classification} />
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    {item.combined_risk_score}/100
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {item.independent_evidence_count} unique /{' '}
                    {item.duplicate_indicators?.length || 0} dup
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{item.correlation_status}</td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => {
                        setUrlInput(item.url);
                        runCorrelation(item.url, item.scan_id);
                      }}
                      className="text-[#1877F2] font-semibold hover:underline"
                    >
                      Re-Correlate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
