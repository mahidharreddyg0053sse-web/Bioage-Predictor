import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { BarChart3, RefreshCw, Loader2, Shield, Cpu } from 'lucide-react';
import { phishguardApi, extractErrorMessage } from '../services/api';
import { ErrorBanner } from '../components/StatusBadges';
import { formatNumber } from '../utils/formatters';

const RISK_COLORS = ['#10B981', '#F59E0B', '#EF4444', '#991B1B'];

export function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await phishguardApi.getAnalytics();
      setData(res);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load analytics data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#1877F2]" />
        Computing live analytics from scan database...
      </div>
    );
  }

  const summary = data?.summary || {};
  const daily = data?.daily_activity || [];
  const weekly = data?.weekly_activity || [];
  const categories = data?.threat_categories || [];
  const riskDist = data?.risk_distribution || [];
  const sourceStats = (data?.source_statistics || []).filter((s) => s.key !== 'total_matches');
  const mlMetrics = data?.ml_model_metrics || {};

  const safeVsThreat = [
    { name: 'Safe URLs', value: summary.safe_urls || 0, color: '#10B981' },
    {
      name: 'Threats (Phishing + Malicious + Suspicious)',
      value:
        (summary.phishing_detected || 0) +
        (summary.malicious_urls || 0) +
        (summary.suspicious_urls || 0),
      color: '#EF4444',
    },
  ];

  return (
    <div className="space-y-5">
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      {/* Top KPI Summary Bar */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Scanned', value: summary.total_urls_scanned ?? 0, accent: 'text-[#1877F2]' },
          {
            label: 'Phishing + Malicious',
            value: (summary.phishing_detected ?? 0) + (summary.malicious_urls ?? 0),
            accent: 'text-red-600',
          },
          { label: 'Suspicious', value: summary.suspicious_urls ?? 0, accent: 'text-amber-600' },
          { label: 'Average Risk Score', value: `${summary.avg_risk_score ?? 0}/100`, accent: 'text-slate-900' },
          {
            label: 'Duplicates Filtered',
            value: summary.deduplicated_indicators ?? 0,
            accent: 'text-purple-600',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl bg-white border border-slate-200 p-4 shadow-card"
          >
            <p className="text-xs font-medium text-slate-500">{card.label}</p>
            <p className={`text-2xl font-extrabold mt-1 ${card.accent}`}>
              {typeof card.value === 'number' ? formatNumber(card.value) : card.value}
            </p>
          </div>
        ))}
      </section>

      {/* Row 1: Daily Scanning Activity + Safe vs Malicious Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-8 rounded-2xl bg-white border border-slate-200 p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#1877F2]" />
              Daily Scanning Activity (Last 7 Days)
            </h3>
            <button
              onClick={loadAnalytics}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 5, right: 10, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '10px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="safe" name="Safe" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="suspicious" name="Suspicious" stackId="a" fill="#F59E0B" />
                <Bar dataKey="phishing" name="Phishing" stackId="a" fill="#EF4444" />
                <Bar dataKey="malicious" name="Malicious" stackId="a" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-5 shadow-card">
          <h3 className="text-[15px] font-bold text-slate-900 mb-4">
            Safe vs Malicious Distribution
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={safeVsThreat}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={3}
                  isAnimationActive={false}
                >
                  {safeVsThreat.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {safeVsThreat.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-700 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Row 2: Weekly Activity + Risk-Level Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-2xl bg-white border border-slate-200 p-5 shadow-card">
          <h3 className="text-[15px] font-bold text-slate-900 mb-4">
            Weekly Scanning Activity (Past 4 Weeks)
          </h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekly} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="total" name="Total Scans" stroke="#1877F2" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="threats" name="Detected Threats" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="safe" name="Safe URLs" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-5 shadow-card">
          <h3 className="text-[15px] font-bold text-slate-900 mb-4">
            Risk-Level Distribution
          </h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskDist} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="level" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="count" name="URLs" radius={[6, 6, 0, 0]}>
                  {riskDist.map((entry, idx) => (
                    <Cell key={entry.level} fill={RISK_COLORS[idx % RISK_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Row 3: Threat Categories + Intelligence Source Matches + ML Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 shadow-card">
          <h3 className="text-[15px] font-bold text-slate-900 mb-4">
            Threat Category Distribution
          </h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categories}
                layout="vertical"
                margin={{ top: 5, right: 16, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis
                  dataKey="category"
                  type="category"
                  width={130}
                  tick={{ fontSize: 11, fill: '#334155' }}
                />
                <Tooltip />
                <Bar dataKey="count" name="Detections" fill="#1877F2" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-5 shadow-card">
          <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-[#1877F2]" />
            Intelligence Source Matches
          </h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceStats} margin={{ top: 5, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="iocs" name="Tracked IoCs" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="queries" name="Live Queries" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-3 rounded-2xl bg-white border border-slate-200 p-5 shadow-card">
          <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-[#1877F2]" />
            ML Classifier Metrics
          </h3>
          <div className="space-y-3 text-xs">
            <p className="text-slate-600 leading-relaxed">
              {mlMetrics.model_type || 'Calibrated RandomForestClassifier'}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Accuracy', val: mlMetrics.accuracy },
                { label: 'Precision', val: mlMetrics.precision },
                { label: 'Recall', val: mlMetrics.recall },
                { label: 'ROC-AUC', val: mlMetrics.roc_auc },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center"
                >
                  <p className="text-[11px] text-slate-500">{m.label}</p>
                  <p className="text-lg font-extrabold text-[#1877F2] mt-0.5">
                    {m.val !== undefined ? `${(m.val * 100).toFixed(1)}%` : 'N/A'}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Features extracted: <strong className="text-slate-800">{mlMetrics.feature_count || 28}</strong>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
