import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Search,
  Shield,
  Bug,
  Users,
  Plus,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { phishguardApi, extractErrorMessage } from '../services/api';
import {
  ErrorBanner,
  ProviderStatusBadge,
  EmptyState,
} from '../components/StatusBadges';
import { formatDateTime } from '../utils/formatters';

export function ThreatIntelligencePage() {
  const [indicators, setIndicators] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  // Search & filter IoCs
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  // Live Provider Lookup State
  const [activeProvider, setActiveProvider] = useState('virustotal');
  const [lookupValue, setLookupValue] = useState('');
  const [lookupType, setLookupType] = useState('domain');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResult, setLookupResult] = useState(null);

  // Add Analyst IoC Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIoc, setNewIoc] = useState({
    indicator_type: 'domain',
    indicator_value: '',
    threat_category: 'Phishing',
    source: 'Analyst Submission',
    confidence_score: 85,
    reputation: 'Malicious',
  });
  const [savingIoc, setSavingIoc] = useState(false);
  const [iocSuccess, setIocSuccess] = useState('');

  const loadIndicators = useCallback(async () => {
    setLoadingList(true);
    setListError('');
    try {
      const res = await phishguardApi.listIndicators({
        search,
        indicator_type: typeFilter,
        source: sourceFilter,
        limit: 100,
      });
      setIndicators(res.items || []);
      setIntegrations(res.integrations || []);
    } catch (err) {
      setListError(extractErrorMessage(err, 'Failed to load threat indicators.'));
    } finally {
      setLoadingList(false);
    }
  }, [search, typeFilter, sourceFilter]);

  useEffect(() => {
    loadIndicators();
  }, [loadIndicators]);

  const handleProviderLookup = async (e) => {
    e.preventDefault();
    const cleaned = lookupValue.trim();
    if (!cleaned) {
      setLookupError('Please enter a domain, URL, or IP address to check.');
      return;
    }
    setLookupError('');
    setLookupLoading(true);
    setLookupResult(null);

    try {
      let data;
      if (activeProvider === 'virustotal') {
        data = await phishguardApi.queryVirusTotal(cleaned, lookupType);
      } else if (activeProvider === 'urlhaus') {
        data = await phishguardApi.queryURLhaus(cleaned, lookupType);
      } else {
        data = await phishguardApi.queryAbuseIPDB(cleaned);
      }
      setLookupResult(data);
      loadIndicators();
    } catch (err) {
      setLookupError(extractErrorMessage(err, 'Threat intelligence query failed.'));
    } finally {
      setLookupLoading(false);
    }
  };

  const handleAddIndicator = async (e) => {
    e.preventDefault();
    if (!newIoc.indicator_value.trim()) return;
    setSavingIoc(true);
    setListError('');
    setIocSuccess('');
    try {
      await phishguardApi.addIndicator(newIoc);
      setIocSuccess(`Indicator "${newIoc.indicator_value}" saved to Threat Intelligence DB.`);
      setNewIoc({ ...newIoc, indicator_value: '' });
      setShowAddForm(false);
      loadIndicators();
    } catch (err) {
      setListError(extractErrorMessage(err, 'Could not add indicator.'));
    } finally {
      setSavingIoc(false);
    }
  };

  const providerTabs = [
    {
      id: 'virustotal',
      label: 'VirusTotal',
      desc: 'URL, Domain & IP Reputation',
      Icon: Shield,
      types: ['domain', 'url', 'ip'],
      placeholder: 'login-security.xyz',
    },
    {
      id: 'urlhaus',
      label: 'URLhaus',
      desc: 'Malware & Phishing URLs',
      Icon: Bug,
      types: ['url', 'domain', 'ip'],
      placeholder: 'http://fake-bank.net',
    },
    {
      id: 'abuseipdb',
      label: 'AbuseIPDB',
      desc: 'IP Abuse Confidence Check',
      Icon: Users,
      types: ['ip'],
      placeholder: '185.220.101.44',
    },
  ];

  const activeTabObj = providerTabs.find((t) => t.id === activeProvider) || providerTabs[0];

  return (
    <div className="space-y-5">
      {/* Provider Status Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providerTabs.map((p) => {
          const intInfo = integrations.find((i) => i.provider_name === p.id);
          const Icon = p.Icon;
          const isSelected = activeProvider === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setActiveProvider(p.id);
                setLookupType(p.types[0]);
                setLookupResult(null);
                setLookupError('');
              }}
              className={`text-left rounded-2xl border p-4 transition-all shadow-card ${
                isSelected
                  ? 'border-[#1877F2] bg-blue-50/40 ring-2 ring-[#1877F2]/15'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#1877F2]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{p.label}</p>
                    <p className="text-[11px] text-slate-500">{p.desc}</p>
                  </div>
                </div>
                <ProviderStatusBadge status={intInfo?.status || 'not_configured'} />
              </div>
              <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500">
                <span>Queries: {intInfo?.total_queries ?? 0}</span>
                <span>Matches: {intInfo?.total_matches ?? 0}</span>
              </div>
            </button>
          );
        })}
      </section>

      {/* Live Reputation & Indicator Lookup Panel */}
      <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
        <h2 className="text-[15px] font-bold text-slate-900 mb-3">
          Query {activeTabObj.label} — Domain, URL & IP Reputation Check
        </h2>
        <form onSubmit={handleProviderLookup} className="flex flex-col sm:flex-row gap-3">
          {activeTabObj.types.length > 1 && (
            <select
              value={lookupType}
              onChange={(e) => setLookupType(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/25"
            >
              {activeTabObj.types.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={lookupValue}
            onChange={(e) => {
              setLookupValue(e.target.value);
              if (lookupError) setLookupError('');
            }}
            placeholder={`Enter ${lookupType.toUpperCase()} (e.g. ${activeTabObj.placeholder})`}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/25 focus:border-[#1877F2]"
          />
          <button
            type="submit"
            disabled={lookupLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {lookupLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Check Reputation
          </button>
        </form>

        {lookupError && (
          <div className="mt-3">
            <ErrorBanner message={lookupError} onDismiss={() => setLookupError('')} />
          </div>
        )}

        {lookupResult && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">
                  {lookupResult.provider_result.provider} Response
                </span>
                <ProviderStatusBadge status={lookupResult.provider_result.status} />
              </div>
              <span className="text-xs text-slate-500">
                Checked: {formatDateTime(lookupResult.provider_result.checked_at)}
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {lookupResult.provider_result.message}
            </p>

            {lookupResult.local_ioc_matches?.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Matching Records in Local Threat IoC Repository (
                  {lookupResult.local_ioc_matches.length})
                </p>
                <div className="space-y-1.5">
                  {lookupResult.local_ioc_matches.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs"
                    >
                      <span className="font-mono font-semibold text-slate-900">
                        [{m.indicator_type.toUpperCase()}] {m.indicator_value}
                      </span>
                      <span className="text-slate-600">
                        {m.threat_category} · {m.source} ({m.confidence_score ?? 'N/A'}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* IoC Database Table */}
      <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-[#1877F2]" />
            Threat Indicators (IoC) Database ({indicators.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={loadIndicators}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1877F2] text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Add IoC
            </button>
          </div>
        </div>

        {iocSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {iocSuccess}
          </div>
        )}

        {listError && (
          <div className="mb-4">
            <ErrorBanner message={listError} onDismiss={() => setListError('')} />
          </div>
        )}

        {/* Add IoC Inline Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddIndicator}
            className="mb-5 rounded-xl border border-blue-200 bg-blue-50/40 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
          >
            <select
              value={newIoc.indicator_type}
              onChange={(e) => setNewIoc({ ...newIoc, indicator_type: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium"
            >
              <option value="domain">Domain</option>
              <option value="url">URL</option>
              <option value="ip">IP Address</option>
              <option value="hash">Hash</option>
            </select>
            <input
              type="text"
              required
              placeholder="Indicator value"
              value={newIoc.indicator_value}
              onChange={(e) => setNewIoc({ ...newIoc, indicator_value: e.target.value })}
              className="sm:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
            />
            <input
              type="text"
              placeholder="Threat category"
              value={newIoc.threat_category}
              onChange={(e) => setNewIoc({ ...newIoc, threat_category: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={newIoc.confidence_score}
              onChange={(e) =>
                setNewIoc({ ...newIoc, confidence_score: Number(e.target.value) })
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={savingIoc}
              className="rounded-lg bg-[#1877F2] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingIoc ? 'Saving...' : 'Save IoC'}
            </button>
          </form>
        )}

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search indicators, categories, or sources..."
              className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/25"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700"
          >
            <option value="all">All Types</option>
            <option value="url">URL</option>
            <option value="domain">Domain</option>
            <option value="ip">IP</option>
            <option value="hash">Hash</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700"
          >
            <option value="all">All Sources</option>
            <option value="VirusTotal">VirusTotal</option>
            <option value="URLhaus">URLhaus</option>
            <option value="AbuseIPDB">AbuseIPDB</option>
            <option value="PhishGuard Feed">PhishGuard Feed</option>
            <option value="Analyst Submission">Analyst Submission</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {indicators.length === 0 && !loadingList ? (
            <EmptyState
              icon={Database}
              title="No matching threat indicators"
              description="Try adjusting your search query or add a new indicator above."
            />
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Indicator Value</th>
                  <th className="py-3 px-3">Threat Category</th>
                  <th className="py-3 px-3">Source</th>
                  <th className="py-3 px-3">Confidence / Rep</th>
                  <th className="py-3 px-3">Last Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {indicators.map((ioc) => (
                  <tr key={ioc.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1877F2] font-bold uppercase text-[10px]">
                        {ioc.indicator_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-900 max-w-xs truncate">
                      {ioc.indicator_value}
                    </td>
                    <td className="py-3 px-3 text-slate-700">{ioc.threat_category}</td>
                    <td className="py-3 px-3 font-semibold text-slate-700">{ioc.source}</td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900">
                        {ioc.confidence_score !== null && ioc.confidence_score !== undefined
                          ? `${ioc.confidence_score}%`
                          : 'N/A'}
                      </span>{' '}
                      <span className="text-slate-500">· {ioc.reputation}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                      {formatDateTime(ioc.last_checked)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
