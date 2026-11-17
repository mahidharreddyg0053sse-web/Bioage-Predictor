import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  RefreshCw,
  Eye,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  GitMerge,
} from 'lucide-react';
import { phishguardApi, extractErrorMessage } from '../services/api';
import {
  ClassificationBadge,
  ClassificationIcon,
  ErrorBanner,
  EmptyState,
} from '../components/StatusBadges';
import { formatDateTime, getRiskColor } from '../utils/formatters';

export function ScanHistoryPage({ onSelectScan, onCorrelate, pageSizeDefault = 10 }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeDefault);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState('');
  const [classification, setClassification] = useState('all');
  const [riskRange, setRiskRange] = useState('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        search,
        classification,
        page,
        page_size: pageSize,
      };
      if (riskRange === 'high') {
        params.min_risk = 62;
      } else if (riskRange === 'medium') {
        params.min_risk = 34;
        params.max_risk = 61;
      } else if (riskRange === 'low') {
        params.max_risk = 33;
      }
      const res = await phishguardApi.getScanHistory(params);
      setItems(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load scan history.'));
    } finally {
      setLoading(false);
    }
  }, [search, classification, riskRange, page, pageSize]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = async (id) => {
    try {
      await phishguardApi.deleteScan(id);
      fetchHistory();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete scan record.'));
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-[#1877F2]" />
            Scanned URLs Archive ({total})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchHistory}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <a
              href={phishguardApi.getCsvExportUrl()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1877F2] text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by URL, domain, or threat category..."
              className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/25"
            />
          </div>

          <select
            value={classification}
            onChange={(e) => {
              setClassification(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700"
          >
            <option value="all">All Classifications</option>
            <option value="Safe">Safe</option>
            <option value="Suspicious">Suspicious</option>
            <option value="Phishing">Phishing</option>
            <option value="Malicious">Malicious</option>
          </select>

          <select
            value={riskRange}
            onChange={(e) => {
              setRiskRange(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700"
          >
            <option value="all">All Risk Levels</option>
            <option value="high">High & Critical (62–100)</option>
            <option value="medium">Medium (34–61)</option>
            <option value="low">Low (0–33)</option>
          </select>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} onDismiss={() => setError('')} />
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          {items.length === 0 && !loading ? (
            <EmptyState
              icon={History}
              title="No matching scan records"
              description="Adjust your filters or scan a new URL to populate history."
            />
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-3">URL</th>
                  <th className="py-3 px-3">Scan Date</th>
                  <th className="py-3 px-3">Classification</th>
                  <th className="py-3 px-3">Risk Score</th>
                  <th className="py-3 px-3">Detection Source</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {items.map((scan) => {
                  const rc = getRiskColor(scan.risk_score);
                  return (
                    <tr key={scan.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-3 max-w-xs">
                        <div className="flex items-center gap-2">
                          <ClassificationIcon classification={scan.classification} className="w-4 h-4" />
                          <div className="min-w-0">
                            <p
                              className="font-mono font-medium text-slate-900 truncate"
                              title={scan.normalized_url}
                            >
                              {scan.url}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {scan.domain} {scan.ip_address ? `· ${scan.ip_address}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {formatDateTime(scan.scanned_at)}
                      </td>
                      <td className="py-3 px-3">
                        <ClassificationBadge classification={scan.classification} />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-extrabold ${rc.text}`}>{scan.risk_score}</span>
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full ${rc.bg}`}
                              style={{ width: `${scan.risk_score}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">
                        {scan.detection_source}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onSelectScan(scan)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-blue-50 hover:text-[#1877F2] hover:border-blue-200"
                          >
                            <Eye className="w-3.5 h-3.5" /> Details
                          </button>
                          <button
                            onClick={() => onCorrelate(scan.normalized_url, scan.id)}
                            title="Correlate Threat"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-[#1877F2]"
                          >
                            <GitMerge className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(scan.id)}
                            title="Delete scan"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="text-slate-400">
              Page {page} of {totalPages} ({total} total records)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold disabled:opacity-40 hover:bg-slate-50"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
