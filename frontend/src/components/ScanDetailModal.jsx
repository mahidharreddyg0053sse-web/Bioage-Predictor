import React, { useState } from 'react';
import {
  X,
  Shield,
  Globe,
  Server,
  FileDown,
  GitMerge,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { ClassificationBadge, ProviderStatusBadge } from './StatusBadges';
import { formatDateTime, getRiskColor } from '../utils/formatters';
import { phishguardApi, extractErrorMessage } from '../services/api';

export function ScanDetailModal({ scan, onClose, onCorrelate }) {
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');

  if (!scan) return null;

  const riskColors = getRiskColor(scan.risk_score);

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    setPdfError('');
    try {
      const report = await phishguardApi.generateReport({
        report_type: 'url_scan',
        scan_id: scan.id,
      });
      window.open(phishguardApi.getReportDownloadUrl(report.id), '_blank');
    } catch (err) {
      setPdfError(extractErrorMessage(err, 'Failed to generate PDF report.'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-bold text-slate-900">Scan Investigation Details</h3>
              <ClassificationBadge classification={scan.classification} />
            </div>
            <p className="text-xs text-slate-500 mt-1 break-all font-mono">{scan.normalized_url}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {pdfError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {pdfError}
            </div>
          )}

          {/* Key metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`rounded-xl border p-3.5 ${riskColors.light} ${riskColors.border}`}>
              <p className="text-xs text-slate-500 font-medium">Risk Score</p>
              <p className={`text-2xl font-extrabold mt-0.5 ${riskColors.text}`}>
                {scan.risk_score}
                <span className="text-xs font-medium text-slate-500">/100</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-xs text-slate-500 font-medium">ML Prediction</p>
              <p className="text-base font-bold text-slate-900 mt-1 capitalize">
                {scan.ml_prediction}
              </p>
              <p className="text-[11px] text-slate-500">
                {(Number(scan.ml_confidence || 0) * 100).toFixed(1)}% confidence
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" /> Domain
              </p>
              <p className="text-sm font-semibold text-slate-900 mt-1 truncate" title={scan.domain}>
                {scan.domain}
              </p>
              <p className="text-[11px] text-slate-500">{scan.threat_category || 'General'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Server className="w-3.5 h-3.5" /> Resolved IP
              </p>
              <p className="text-sm font-semibold text-slate-900 mt-1 font-mono">
                {scan.ip_address || 'Unresolved'}
              </p>
              <p className="text-[11px] text-slate-500">{formatDateTime(scan.scanned_at)}</p>
            </div>
          </div>

          {/* Threat Intelligence Providers */}
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-2.5 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-[#1877F2]" /> External Threat Intelligence Results
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'VirusTotal', data: scan.virustotal_result },
                { label: 'URLhaus', data: scan.urlhaus_result },
                { label: 'AbuseIPDB', data: scan.abuseipdb_result },
              ].map(({ label, data }) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">{label}</span>
                    <ProviderStatusBadge status={data?.status || 'not_configured'} />
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {data?.message || 'No response recorded.'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Detection Reasons */}
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-2">Detection Reasons</h4>
            <ul className="space-y-1.5">
              {(scan.detection_reasons || []).map((reason, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-2">Security Recommendations</h4>
            <ul className="space-y-1.5">
              {(scan.recommendations || []).map((rec, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-xs text-slate-700 bg-blue-50/50 rounded-lg px-3 py-2 border border-blue-100"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1877F2] shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
          >
            Close
          </button>
          <div className="flex items-center gap-2.5">
            {onCorrelate && (
              <button
                onClick={() => {
                  onClose();
                  onCorrelate(scan.normalized_url, scan.id);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1877F2] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
              >
                <GitMerge className="w-3.5 h-3.5" />
                Open in Threat Correlation
              </button>
            )}
            <button
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1877F2] rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {generatingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              Download PDF Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
