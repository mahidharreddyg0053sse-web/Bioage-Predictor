import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  FileDown,
  Download,
  Shield,
  RefreshCw,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { phishguardApi, extractErrorMessage } from '../services/api';
import { ErrorBanner, EmptyState } from '../components/StatusBadges';
import { formatDateTime } from '../utils/formatters';

export function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [recentScans, setRecentScans] = useState([]);
  const [selectedScanId, setSelectedScanId] = useState('');
  const [customTitle, setCustomTitle] = useState('');

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [repRes, scanRes] = await Promise.all([
        phishguardApi.listReports(),
        phishguardApi.getScanHistory({ page: 1, page_size: 25 }),
      ]);
      setReports(repRes.items || []);
      const scans = scanRes.items || [];
      setRecentScans(scans);
      if (scans.length > 0 && !selectedScanId) {
        setSelectedScanId(scans[0].id);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load reports.'));
    } finally {
      setLoading(false);
    }
  }, [selectedScanId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateScanReport = async () => {
    if (!selectedScanId) {
      setError('Select a scanned URL first.');
      return;
    }
    setGenerating('scan');
    setError('');
    setSuccessMsg('');
    try {
      const rep = await phishguardApi.generateReport({
        report_type: 'url_scan',
        scan_id: selectedScanId,
        title: customTitle.trim() || undefined,
      });
      setCustomTitle('');
      setSuccessMsg(`Generated PDF report "${rep.title}".`);
      loadData();
      window.open(phishguardApi.getReportDownloadUrl(rep.id), '_blank');
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not generate URL scan report.'));
    } finally {
      setGenerating('');
    }
  };

  const handleGenerateThreatIntelReport = async () => {
    setGenerating('intel');
    setError('');
    setSuccessMsg('');
    try {
      const rep = await phishguardApi.generateReport({
        report_type: 'threat_intelligence',
      });
      setSuccessMsg(`Generated Threat Intelligence PDF report "${rep.title}".`);
      loadData();
      window.open(phishguardApi.getReportDownloadUrl(rep.id), '_blank');
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not generate Threat Intelligence report.'));
    } finally {
      setGenerating('');
    }
  };

  return (
    <div className="space-y-5">
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* Report Generation Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 1. Individual URL Scan Report */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-card flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-[#1877F2]" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Individual URL Scan Report</h3>
            <p className="text-xs text-slate-500 mt-1">
              Detailed PDF including ML verdict, risk breakdown, external TI status, and analyst
              remediation steps.
            </p>
            <div className="mt-4 space-y-2.5">
              <select
                value={selectedScanId}
                onChange={(e) => setSelectedScanId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
              >
                {recentScans.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.classification} · {s.risk_score}] {s.url}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Optional custom report title..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
          </div>
          <button
            onClick={handleGenerateScanReport}
            disabled={generating === 'scan' || !selectedScanId}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {generating === 'scan' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            Generate & Download PDF
          </button>
        </div>

        {/* 2. Threat Intelligence Summary Report */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-card flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Threat Intelligence PDF Report</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Executive summary of overall threat posture, configured TI provider telemetry, and
              latest correlated IoCs across VirusTotal, URLhaus, and AbuseIPDB.
            </p>
          </div>
          <button
            onClick={handleGenerateThreatIntelReport}
            disabled={generating === 'intel'}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {generating === 'intel' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            Generate Threat Intel PDF
          </button>
        </div>

        {/* 3. Export Scan Records CSV */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-card flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
              <Download className="w-5 h-5 text-slate-700" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Export Scan History (CSV)</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Download all stored scan records including URLs, domains, resolved IPs, ML confidence
              scores, classifications, and timestamps for SIEM ingestion or spreadsheet analysis.
            </p>
          </div>
          <a
            href={phishguardApi.getCsvExportUrl()}
            onClick={() => setTimeout(loadData, 1000)}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            Export All Scans as CSV
          </a>
        </div>
      </section>

      {/* Previous Reports Archive */}
      <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-slate-900">
            Generated Reports Archive ({reports.length})
          </h3>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {reports.length === 0 && !loading ? (
          <EmptyState
            icon={FileText}
            title="No reports generated yet"
            description="Generate an individual URL scan PDF, threat intelligence PDF, or CSV export above."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-3">Report Title</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Format</th>
                  <th className="py-3 px-3">Summary</th>
                  <th className="py-3 px-3">Generated Date</th>
                  <th className="py-3 px-3 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-semibold text-slate-900">{rep.title}</td>
                    <td className="py-3 px-3 text-slate-600 capitalize">
                      {(rep.report_type || '').replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1877F2] font-bold uppercase text-[10px]">
                        {rep.format}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{rep.summary}</td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                      {formatDateTime(rep.created_at)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <a
                        href={phishguardApi.getReportDownloadUrl(rep.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-[#1877F2] font-semibold hover:bg-blue-100"
                      >
                        <FileDown className="w-3.5 h-3.5" /> Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
