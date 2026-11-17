import React, { useState } from 'react';
import {
  Link2,
  AlertTriangle,
  ShieldCheck,
  Flame,
  BarChart2,
  Shield,
  TrendingUp,
  Search,
  Clock,
  Globe,
  ArrowRight,
  Lock,
  Users,
  Bug,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  MiniSparkline,
  ThreatOverviewDonut,
  RiskTrendAreaChart,
} from '../charts/DashboardCharts';
import {
  ClassificationBadge,
  ClassificationIcon,
  ErrorBanner,
  ProviderStatusBadge,
} from '../components/StatusBadges';
import {
  formatNumber,
  formatRelativeTime,
  validateClientUrl,
} from '../utils/formatters';

const QUICK_SAMPLE_URLS = [
  { label: 'phishing-site.com', url: 'http://phishing-site.com/account/login', icon: Globe },
  { label: 'bit.ly/abc123', url: 'https://bit.ly/abc123', icon: Link2 },
  { label: 'malicious-domain.xyz', url: 'http://malicious-domain.xyz/verify', icon: Bug },
];

export function DashboardPage({
  data,
  loading,
  error,
  onQuickScan,
  onNavigate,
  onSelectScan,
}) {
  const [quickUrl, setQuickUrl] = useState('');
  const [quickError, setQuickError] = useState('');
  const [scanningQuick, setScanningQuick] = useState(false);

  const summary = data?.summary || {};
  const trends = summary.trends || {};
  const dailyActivity = data?.daily_activity || [];
  const threatOverview = data?.threat_overview || [];
  const sourceStats = data?.source_statistics || [];
  const recentScans = data?.recent_scans || [];

  const handleQuickSubmit = async (e, overrideUrl = null) => {
    if (e) e.preventDefault();
    const target = overrideUrl ?? quickUrl;
    const validationErr = validateClientUrl(target);
    if (validationErr) {
      setQuickError(validationErr);
      return;
    }
    setQuickError('');
    setScanningQuick(true);
    try {
      await onQuickScan(target.trim());
      setQuickUrl('');
    } catch (err) {
      setQuickError(err?.message || 'Scan failed. Please try again.');
    } finally {
      setScanningQuick(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-[#1877F2]" />
          Loading live threat telemetry from database...
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      title: 'Total URLs Scanned',
      value: summary.total_urls_scanned ?? 0,
      trend: trends.total ?? 0,
      sparkKey: 'total',
      sparkColor: '#1877F2',
      bg: 'bg-gradient-to-br from-[#EEF6FF] to-[#F8FBFF]',
      border: 'border-[#DBEAFE]',
      iconBg: 'text-[#1877F2]',
      trendColor: 'text-emerald-600',
      Icon: Link2,
    },
    {
      title: 'Phishing Detected',
      value: summary.phishing_detected ?? 0,
      trend: trends.phishing ?? 0,
      sparkKey: 'phishing',
      sparkColor: '#EF4444',
      bg: 'bg-gradient-to-br from-[#FEF2F2] to-[#FFF8F8]',
      border: 'border-[#FEE2E2]',
      iconBg: 'text-[#EF4444]',
      trendColor: 'text-red-600',
      Icon: AlertTriangle,
    },
    {
      title: 'Safe URLs',
      value: summary.safe_urls ?? 0,
      trend: trends.safe ?? 0,
      sparkKey: 'safe',
      sparkColor: '#10B981',
      bg: 'bg-gradient-to-br from-[#ECFDF5] to-[#F6FEF9]',
      border: 'border-[#D1FAE5]',
      iconBg: 'text-[#10B981]',
      trendColor: 'text-emerald-600',
      Icon: ShieldCheck,
    },
    {
      title: 'Critical Threats',
      value: summary.critical_threats ?? 0,
      subtitle: `${summary.suspicious_urls ?? 0} Suspicious`,
      trend: trends.critical ?? 0,
      sparkKey: 'critical',
      sparkColor: '#F59E0B',
      bg: 'bg-gradient-to-br from-[#FFFBEB] to-[#FFFDFA]',
      border: 'border-[#FEF3C7]',
      iconBg: 'text-[#F59E0B]',
      trendColor: 'text-amber-600',
      Icon: Flame,
    },
  ];

  const getSourceIcon = (key) => {
    if (key === 'virustotal') {
      return (
        <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-[#1877F2]" />
        </div>
      );
    }
    if (key === 'urlhaus') {
      return (
        <div className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
          <Bug className="w-5 h-5 text-purple-600" />
        </div>
      );
    }
    if (key === 'abuseipdb') {
      return (
        <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-amber-500" />
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
        <Globe className="w-5 h-5 text-sky-600" />
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {error && <ErrorBanner message={error} />}

      {/* ROW 1: 4 Tinted KPI Sparkline Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.Icon;
          const isPositive = card.trend >= 0;
          return (
            <div
              key={card.title}
              className={`rounded-2xl border ${card.border} ${card.bg} p-4 sm:p-5 shadow-card transition-shadow hover:shadow-card-hover`}
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 shrink-0">
                  <Icon className={`w-9 h-9 ${card.iconBg}`} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[28px] font-extrabold text-slate-900 leading-none tracking-tight">
                    {formatNumber(card.value)}
                  </div>
                  <p className="text-[13px] font-medium text-slate-700 mt-1.5 truncate">
                    {card.title}
                  </p>
                  {card.subtitle && (
                    <p className="text-[11px] font-medium text-amber-700 mt-0.5">{card.subtitle}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-end justify-between gap-2">
                <div className={`inline-flex items-center gap-0.5 text-xs font-bold ${card.trendColor}`}>
                  {isPositive ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  <span>{Math.abs(card.trend)}%</span>
                </div>
                <MiniSparkline
                  data={dailyActivity}
                  dataKey={card.sparkKey}
                  color={card.sparkColor}
                />
              </div>
            </div>
          );
        })}
      </section>

      {/* ROW 2: Threat Overview | Threat Intelligence Sources | Risk Trend */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Threat Overview Donut */}
        <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-5 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#1877F2]" />
              Threat Overview
            </h2>
            <span className="text-[11px] font-medium text-slate-500">
              {summary.suspicious_urls ?? 0} Suspicious
            </span>
          </div>
          <ThreatOverviewDonut
            data={threatOverview}
            totalScans={summary.total_urls_scanned ?? 0}
          />
        </div>

        {/* Threat Intelligence Sources 2x2 Grid */}
        <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1877F2]" />
              Threat Intelligence Sources
            </h2>
            <button
              onClick={() => onNavigate('threat-intel')}
              className="text-xs font-semibold text-[#1877F2] hover:underline"
            >
              Manage
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {sourceStats.map((src) => (
              <div
                key={src.key}
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 hover:border-blue-100 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  {getSourceIcon(src.key)}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{src.name}</p>
                    <p className="text-lg font-extrabold text-slate-900 leading-tight mt-0.5">
                      {formatNumber(src.count)}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{src.label}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <ProviderStatusBadge status={src.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Trend Area Chart */}
        <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-5 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#1877F2]" />
              Risk Trend (Last 7 Days)
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              Avg: {summary.avg_risk_score ?? 0}/100
            </span>
          </div>
          <RiskTrendAreaChart data={dailyActivity} />
        </div>
      </section>

      {/* ROW 3: Scan URL Quick Box | Recent Scanning Activity | Block Threats Card */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Scan URL for Threat Analysis */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 shadow-card flex flex-col justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Link2 className="w-4 h-4 text-[#1877F2]" />
              Scan URL for Threat Analysis
            </h2>

            <form onSubmit={handleQuickSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={quickUrl}
                onChange={(e) => {
                  setQuickUrl(e.target.value);
                  if (quickError) setQuickError('');
                }}
                placeholder="Enter URL (e.g. https://example.com)"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/25 focus:border-[#1877F2]"
                disabled={scanningQuick}
              />
              <button
                type="submit"
                disabled={scanningQuick}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 shrink-0"
              >
                {scanningQuick ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Scan Now
                  </>
                )}
              </button>
            </form>

            {quickError && (
              <p className="text-xs text-red-600 mt-2 font-medium">{quickError}</p>
            )}
          </div>

          <div className="mt-5">
            <div className="relative flex items-center justify-center mb-3">
              <div className="w-full border-t border-slate-200" />
              <span className="bg-white px-3 text-xs font-medium text-slate-400 absolute">
                Or
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {QUICK_SAMPLE_URLS.map((sample) => {
                const SampleIcon = sample.icon;
                return (
                  <button
                    key={sample.label}
                    type="button"
                    disabled={scanningQuick}
                    onClick={() => handleQuickSubmit(null, sample.url)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-[#1877F2] transition-colors truncate"
                    title={`Quick scan ${sample.url}`}
                  >
                    <SampleIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{sample.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Scanning Activity */}
        <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-5 shadow-card">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#1877F2]" />
              Recent Scanning Activity
            </h2>
            <button
              onClick={() => onNavigate('history')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1877F2] hover:underline"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentScans.slice(0, 5).map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectScan(item)}
                className="w-full flex items-center justify-between gap-2.5 py-2.5 text-left hover:bg-slate-50 rounded-lg px-1.5 -mx-1.5 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <ClassificationIcon classification={item.classification} className="w-4 h-4" />
                  <span className="text-[13px] font-medium text-slate-800 truncate">
                    {item.url}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <ClassificationBadge classification={item.classification} />
                  <span className="text-[11px] text-slate-500 w-16 text-right">
                    {formatRelativeTime(item.scanned_at)}
                  </span>
                </div>
              </button>
            ))}

            {recentScans.length === 0 && (
              <p className="text-xs text-slate-500 py-8 text-center">
                No scans recorded yet. Run your first URL scan on the left.
              </p>
            )}
          </div>
        </div>

        {/* Block Threats Before They Strike */}
        <div className="lg:col-span-3 rounded-2xl border border-blue-100 circuit-card-bg p-5 shadow-card flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-white border border-blue-200 shadow-sm flex items-center justify-center mb-3.5">
            <div className="relative">
              <Shield className="w-8 h-8 text-[#1877F2]" strokeWidth={2.2} />
              <Lock className="w-3.5 h-3.5 text-slate-900 absolute inset-0 m-auto" />
            </div>
          </div>
          <h3 className="text-[16px] font-extrabold text-slate-900 leading-snug">
            Block Threats
            <br />
            Before They Strike
          </h3>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed max-w-[200px]">
            AI-powered detection with real-time threat intelligence correlation.
          </p>
          <button
            onClick={() => onNavigate('correlation')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#1877F2] px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            Learn More <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
}
