import React, { useState } from 'react';
import {
  Home,
  Link2,
  Database,
  GitMerge,
  History,
  BarChart3,
  FileText,
  Settings,
  Calendar,
  ChevronDown,
  Menu,
  X,
  CheckCircle2,
  RefreshCw,
  LogOut,
  User,
} from 'lucide-react';
import { PhishGuardLogo } from '../components/PhishGuardLogo';
import { formatDateTime } from '../utils/formatters';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'scanner', label: 'URL Scanner', icon: Link2 },
  { id: 'threat-intel', label: 'Threat Intelligence', icon: Database },
  { id: 'correlation', label: 'Threat Correlation', icon: GitMerge },
  { id: 'history', label: 'Scan History', icon: History },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const PAGE_HEADERS = {
  dashboard: {
    title: 'Welcome back, Security Analyst!',
    subtitle: 'Monitor threats and keep the web safer',
  },
  scanner: {
    title: 'URL Threat Scanner',
    subtitle: 'Extract URL features, run Random Forest ML detection, and check threat intelligence',
  },
  'threat-intel': {
    title: 'Threat Intelligence',
    subtitle: 'Query VirusTotal, URLhaus, AbuseIPDB and manage threat indicators (IoCs)',
  },
  correlation: {
    title: 'Threat Correlation Engine',
    subtitle: 'Correlate ML detections with deduplicated external threat intelligence evidence',
  },
  history: {
    title: 'Scan History',
    subtitle: 'Search, filter, and audit all previously analyzed URLs stored in the database',
  },
  analytics: {
    title: 'Security Analytics',
    subtitle: 'Analyze phishing trends, threat categories, risk distributions, and source coverage',
  },
  reports: {
    title: 'Security Reports',
    subtitle: 'Generate downloadable PDF assessments and export structured CSV scan logs',
  },
  settings: {
    title: 'Settings & System Status',
    subtitle: 'Manage analyst profile, application preferences, API integrations, and database health',
  },
};

export function MainLayout({
  activePage,
  onNavigate,
  systemOnline,
  lastUpdated,
  onRefresh,
  isRefreshing,
  profile,
  onLogout,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const headerInfo = PAGE_HEADERS[activePage] || PAGE_HEADERS.dashboard;
  const displayName = profile?.full_name || 'Security Analyst';
  const displayTitle =
    activePage === 'dashboard' ? `Welcome back, ${displayName}!` : headerInfo.title;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 select-none">
      {/* Brand Header */}
      <div className="pt-6 pb-5 px-5 flex items-center justify-center">
        <button
          onClick={() => {
            onNavigate('dashboard');
            setMobileMenuOpen(false);
          }}
          className="focus:outline-none"
        >
          <PhishGuardLogo />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3.5 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] font-medium transition-colors ${
                isActive
                  ? 'bg-[#1877F2] text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-[18px] h-[18px] shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-500'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Safety Badge Card + Analyst Profile Strip */}
      <div className="p-3.5 space-y-3 mt-auto">
        <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/70 to-blue-100/50 px-4 py-4 text-center">
          <div className="mx-auto w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm mb-2">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <p className="text-[13px] font-bold text-slate-900">Stay Safe Online</p>
          <p className="text-[11px] text-slate-600 mt-0.5">Detect • Analyze • Protect</p>
        </div>

        {/* User Profile Footer */}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
          <button
            onClick={() => {
              onNavigate('settings');
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-2.5 min-w-0 text-left"
          >
            <div className="w-8 h-8 rounded-full bg-[#1877F2]/10 border border-[#1877F2]/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-[#1877F2]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{displayName}</p>
              <p className="text-[11px] text-slate-500 truncate">
                {profile?.role || 'Lead SOC Analyst'}
              </p>
            </div>
          </button>
          <button
            onClick={onLogout}
            title="Logout"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-[236px] shrink-0 fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/35"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full bg-white shadow-xl z-10">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-[236px] min-w-0 flex flex-col bg-white">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 sm:px-6 lg:px-7 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-[24px] font-extrabold tracking-tight text-slate-900 truncate">
                  {displayTitle}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                  {headerInfo.subtitle}
                </p>
              </div>
            </div>

            {/* Right Status & Profile Controls */}
            <div className="flex items-center gap-3 sm:gap-4 ml-auto">
              {/* System Online Pill */}
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border ${
                  systemOnline
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    systemOnline ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                {systemOnline ? 'System Online' : 'Backend Offline'}
              </div>

              <div className="hidden md:block h-5 w-px bg-slate-200" />

              {/* Last Updated + Refresh */}
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Last Updated: {formatDateTime(lastUpdated)}</span>
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  title="Refresh dashboard data"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#1877F2] hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* User Avatar Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 p-1 rounded-full hover:bg-slate-100 transition-colors"
                  aria-label="User menu"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center">
                    <User className="w-5 h-5 text-[#1877F2]" />
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>

                {profileMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-20">
                      <div className="px-3.5 py-2 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {profile?.email || 'analyst@phishguard.local'}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setProfileMenuOpen(false);
                          onNavigate('settings');
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-500" />
                        Profile & Settings
                      </button>
                      <button
                        onClick={() => {
                          setProfileMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 px-4 sm:px-6 lg:px-7 py-5 bg-white">{children}</main>
      </div>
    </div>
  );
}
