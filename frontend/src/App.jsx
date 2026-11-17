import React, { useState, useEffect, useCallback } from 'react';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { UrlScannerPage } from './pages/UrlScannerPage';
import { ThreatIntelligencePage } from './pages/ThreatIntelligencePage';
import { ThreatCorrelationPage } from './pages/ThreatCorrelationPage';
import { ScanHistoryPage } from './pages/ScanHistoryPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ScanDetailModal } from './components/ScanDetailModal';
import { PhishGuardLogo } from './components/PhishGuardLogo';
import { phishguardApi, extractErrorMessage } from './services/api';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [systemOnline, setSystemOnline] = useState(true);
  const [profile, setProfile] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Cross-page handoff state
  const [latestScanResult, setLatestScanResult] = useState(null);
  const [selectedScanDetail, setSelectedScanDetail] = useState(null);
  const [correlationTarget, setCorrelationTarget] = useState(null);
  const [loggedOut, setLoggedOut] = useState(false);

  const loadCoreData = useCallback(async () => {
    setIsRefreshing(true);
    setDashboardError('');
    try {
      const [dashRes, settingsRes] = await Promise.all([
        phishguardApi.getDashboard(),
        phishguardApi.getSettings(),
      ]);
      setDashboardData(dashRes);
      setProfile(settingsRes.profile || null);
      setSystemOnline(true);
    } catch (err) {
      setSystemOnline(false);
      setDashboardError(extractErrorMessage(err, 'Failed to connect to PhishGuard backend.'));
    } finally {
      setDashboardLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCoreData();
  }, [loadCoreData]);

  const handleQuickScanFromDashboard = async (url) => {
    const res = await phishguardApi.scanUrl(url, true);
    setLatestScanResult(res);
    setActivePage('scanner');
    loadCoreData();
    return res;
  };

  const handleOpenScanDetail = async (scanRow) => {
    try {
      const full = await phishguardApi.getScanById(scanRow.id);
      setSelectedScanDetail(full);
    } catch {
      setSelectedScanDetail(scanRow);
    }
  };

  const handleOpenCorrelation = (url, scanId = null) => {
    setCorrelationTarget({ url, scanId, ts: Date.now() });
    setActivePage('correlation');
  };

  const handleLogout = async () => {
    try {
      await phishguardApi.logout();
    } catch {
      // ignore
    }
    setLoggedOut(true);
  };

  if (loggedOut) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-card text-center space-y-4">
          <PhishGuardLogo />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Session Ended</h2>
            <p className="text-xs text-slate-500 mt-1">
              You have cleanly logged out of the PhishGuard Security Operations console.
            </p>
          </div>
          <button
            onClick={() => {
              setLoggedOut(false);
              setActivePage('dashboard');
              loadCoreData();
            }}
            className="w-full rounded-xl bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Sign Back In as Security Analyst
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <MainLayout
        activePage={activePage}
        onNavigate={(page) => {
          setActivePage(page);
          if (page === 'dashboard') loadCoreData();
        }}
        systemOnline={systemOnline}
        lastUpdated={dashboardData?.last_updated}
        onRefresh={loadCoreData}
        isRefreshing={isRefreshing}
        profile={profile}
        onLogout={handleLogout}
      >
        {activePage === 'dashboard' && (
          <DashboardPage
            data={dashboardData}
            loading={dashboardLoading}
            error={dashboardError}
            onQuickScan={handleQuickScanFromDashboard}
            onNavigate={setActivePage}
            onSelectScan={handleOpenScanDetail}
          />
        )}

        {activePage === 'scanner' && (
          <UrlScannerPage
            initialResult={latestScanResult}
            onScanComplete={(res) => {
              setLatestScanResult(res);
              loadCoreData();
            }}
            onOpenCorrelation={handleOpenCorrelation}
          />
        )}

        {activePage === 'threat-intel' && <ThreatIntelligencePage />}

        {activePage === 'correlation' && (
          <ThreatCorrelationPage initialTarget={correlationTarget} />
        )}

        {activePage === 'history' && (
          <ScanHistoryPage
            onSelectScan={handleOpenScanDetail}
            onCorrelate={handleOpenCorrelation}
            pageSizeDefault={profile?.preferences?.default_page_size || 10}
          />
        )}

        {activePage === 'analytics' && <AnalyticsPage />}

        {activePage === 'reports' && <ReportsPage />}

        {activePage === 'settings' && (
          <SettingsPage
            onProfileUpdated={(updated) => setProfile(updated)}
            onLogout={handleLogout}
          />
        )}
      </MainLayout>

      <ScanDetailModal
        scan={selectedScanDetail}
        onClose={() => setSelectedScanDetail(null)}
        onCorrelate={handleOpenCorrelation}
      />
    </>
  );
}
