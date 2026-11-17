import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Sliders,
  Database,
  Plug,
  LogOut,
  Save,
  RefreshCw,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { phishguardApi, extractErrorMessage } from '../services/api';
import { ErrorBanner, ProviderStatusBadge } from '../components/StatusBadges';
import { formatDateTime } from '../utils/formatters';

export function SettingsPage({ onProfileUpdated, onLogout }) {
  const [settingsData, setSettingsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [profileForm, setProfileForm] = useState({
    full_name: 'Security Analyst',
    email: 'analyst@phishguard.local',
    role: 'Lead SOC Analyst',
    organization: 'PhishGuard Security Operations',
  });

  const [prefsForm, setPrefsForm] = useState({
    auto_correlate: true,
    risk_alert_threshold: 70,
    default_page_size: 10,
    enable_dns_resolution: true,
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [testingConn, setTestingConn] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await phishguardApi.getSettings();
      setSettingsData(res);
      if (res.profile) {
        setProfileForm({
          full_name: res.profile.full_name || 'Security Analyst',
          email: res.profile.email || 'analyst@phishguard.local',
          role: res.profile.role || 'Lead SOC Analyst',
          organization: res.profile.organization || 'PhishGuard Security Operations',
        });
      }
      if (res.preferences) {
        setPrefsForm({
          auto_correlate: res.preferences.auto_correlate ?? true,
          risk_alert_threshold: res.preferences.risk_alert_threshold ?? 70,
          default_page_size: res.preferences.default_page_size ?? 10,
          enable_dns_resolution: res.preferences.enable_dns_resolution ?? true,
        });
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setError('');
    setSuccess('');
    try {
      const res = await phishguardApi.updateProfile(profileForm);
      setSuccess(res.message || 'Profile updated successfully.');
      if (onProfileUpdated) onProfileUpdated(res.profile);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePrefs = async (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    setError('');
    setSuccess('');
    try {
      const res = await phishguardApi.updatePreferences(prefsForm);
      setSuccess(res.message || 'Preferences saved.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to save preferences.'));
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleTestConnections = async () => {
    setTestingConn(true);
    setError('');
    setSuccess('');
    try {
      const res = await phishguardApi.testConnections();
      setSettingsData((prev) => ({
        ...prev,
        database: res.database,
        integrations: res.integrations,
      }));
      setSuccess('Connection status refreshed for database and all threat intelligence providers.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to test API connections.'));
    } finally {
      setTestingConn(false);
    }
  };

  if (loading && !settingsData) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#1877F2]" />
        Loading system settings...
      </div>
    );
  }

  const dbStatus = settingsData?.database || {};
  const integrations = settingsData?.integrations || [];

  return (
    <div className="space-y-5 max-w-5xl">
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {success}
        </div>
      )}

      {/* User Profile & Application Preferences */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
          <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-[#1877F2]" />
            User Profile Settings
          </h2>
          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={profileForm.full_name}
                onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/25"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/25"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <input
                  type="text"
                  required
                  value={profileForm.role}
                  onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/25"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Organization
                </label>
                <input
                  type="text"
                  value={profileForm.organization}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, organization: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/25"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1877F2] px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingProfile ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save Profile
            </button>
          </form>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
          <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Sliders className="w-4 h-4 text-[#1877F2]" />
            Application Preferences
          </h2>
          <form onSubmit={handleSavePrefs} className="space-y-4">
            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Automatic Threat Correlation
                </p>
                <p className="text-[11px] text-slate-500">
                  Correlate every scanned URL with external TI feeds automatically.
                </p>
              </div>
              <input
                type="checkbox"
                checked={prefsForm.auto_correlate}
                onChange={(e) =>
                  setPrefsForm({ ...prefsForm, auto_correlate: e.target.checked })
                }
                className="mt-1 rounded border-slate-300 text-[#1877F2]"
              />
            </label>

            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Safe DNS IP Resolution
                </p>
                <p className="text-[11px] text-slate-500">
                  Resolve public domain IPs for AbuseIPDB checks (private IPs always blocked).
                </p>
              </div>
              <input
                type="checkbox"
                checked={prefsForm.enable_dns_resolution}
                onChange={(e) =>
                  setPrefsForm({ ...prefsForm, enable_dns_resolution: e.target.checked })
                }
                className="mt-1 rounded border-slate-300 text-[#1877F2]"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  High-Risk Alert Threshold
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={prefsForm.risk_alert_threshold}
                  onChange={(e) =>
                    setPrefsForm({ ...prefsForm, risk_alert_threshold: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default History Page Size
                </label>
                <select
                  value={prefsForm.default_page_size}
                  onChange={(e) =>
                    setPrefsForm({ ...prefsForm, default_page_size: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {[5, 10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} rows
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPrefs}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1877F2] px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingPrefs ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save Preferences
            </button>
          </form>
        </section>
      </div>

      {/* API Integration Status & Database Connection Status */}
      <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
              <Plug className="w-4 h-4 text-[#1877F2]" />
              API Integration & Database Connection Status
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All API keys are stored strictly in backend environment variables and never exposed to
              the browser.
            </p>
          </div>
          <button
            onClick={handleTestConnections}
            disabled={testingConn}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingConn ? 'animate-spin' : ''}`} />
            Test Connections
          </button>
        </div>

        {/* Database Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4 text-[#1877F2]" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                {dbStatus.engine || 'Database Storage'}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">{dbStatus.message}</p>
            </div>
          </div>
          <ProviderStatusBadge status={dbStatus.status || 'connected'} />
        </div>

        {/* Threat Intelligence Providers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {integrations.map((intg) => (
            <div
              key={intg.provider_name}
              className="rounded-xl border border-slate-200 p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">{intg.display_name}</span>
                <ProviderStatusBadge status={intg.status} />
              </div>
              <p className="text-xs text-slate-600">
                {intg.is_configured
                  ? `Configured in backend .env · ${intg.total_queries} queries`
                  : `API key not set in backend .env (${intg.provider_name.toUpperCase()}_API_KEY)`}
              </p>
              {intg.last_checked_at && (
                <p className="text-[11px] text-slate-400">
                  Last checked: {formatDateTime(intg.last_checked_at)}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Security Posture Notice */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              SSRF Protection Enabled · Rate Limit:{' '}
              {settingsData?.security?.rate_limit_rpm || 120} req/min · External Timeout:{' '}
              {settingsData?.security?.external_timeout_sec || 8}s
            </span>
          </div>
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout Session
          </button>
        </div>
      </section>
    </div>
  );
}
