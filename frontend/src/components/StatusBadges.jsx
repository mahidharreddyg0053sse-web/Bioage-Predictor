import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, XCircle, WifiOff, Clock } from 'lucide-react';

export function ClassificationBadge({ classification, size = 'sm' }) {
  const styles = {
    Safe: 'bg-emerald-500 text-white',
    Phishing: 'bg-red-500 text-white',
    Suspicious: 'bg-amber-500 text-white',
    Malicious: 'bg-rose-600 text-white',
  };

  const sizeClass =
    size === 'lg'
      ? 'px-3.5 py-1.5 text-sm font-semibold'
      : 'px-2.5 py-0.5 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full whitespace-nowrap ${sizeClass} ${
        styles[classification] || 'bg-slate-600 text-white'
      }`}
    >
      {classification || 'Unknown'}
    </span>
  );
}

export function ClassificationIcon({ classification, className = 'w-5 h-5' }) {
  if (classification === 'Safe') {
    return <CheckCircle2 className={`${className} text-emerald-500 shrink-0`} />;
  }
  if (classification === 'Suspicious') {
    return <AlertTriangle className={`${className} text-amber-500 shrink-0`} />;
  }
  if (classification === 'Malicious') {
    return <ShieldAlert className={`${className} text-rose-600 shrink-0`} />;
  }
  return <AlertTriangle className={`${className} text-red-500 shrink-0`} />;
}

export function ProviderStatusBadge({ status }) {
  const config = {
    ok: {
      label: 'Connected',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
    },
    connected: {
      label: 'Connected',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
    },
    active: {
      label: 'Active',
      cls: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-500',
    },
    local_fallback: {
      label: 'Local SQLite',
      cls: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-500',
    },
    not_configured: {
      label: 'Not Configured',
      cls: 'bg-slate-100 text-slate-600 border-slate-200',
      dot: 'bg-slate-400',
    },
    unavailable: {
      label: 'Unavailable',
      cls: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500',
    },
    degraded: {
      label: 'Degraded',
      cls: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500',
    },
    rate_limited: {
      label: 'Rate Limited',
      cls: 'bg-orange-50 text-orange-700 border-orange-200',
      dot: 'bg-orange-500',
    },
    skipped: {
      label: 'Skipped',
      cls: 'bg-slate-100 text-slate-600 border-slate-200',
      dot: 'bg-slate-400',
    },
    error: {
      label: 'Error',
      cls: 'bg-red-50 text-red-700 border-red-200',
      dot: 'bg-red-500',
    },
  };

  const item = config[status] || config.unavailable;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
      {item.label}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  const styles = {
    critical: 'bg-red-50 text-red-700 border-red-200',
    high: 'bg-rose-50 text-rose-700 border-rose-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide border ${
        styles[severity] || styles.medium
      }`}
    >
      {severity || 'info'}
    </span>
  );
}

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <div className="flex items-start gap-2.5">
        <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-500 hover:text-red-700 text-xs font-semibold shrink-0"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

export function UnavailableNotice({ providers = [] }) {
  if (!providers || providers.length === 0) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
      <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold">External Intelligence Coverage Notice: </span>
        {providers.map((p) => `${p.provider} (${p.status})`).join(', ')} could not be queried.
        Unavailable sources are never treated as clean results.
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Clock, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-md">{description}</p>}
    </div>
  );
}
