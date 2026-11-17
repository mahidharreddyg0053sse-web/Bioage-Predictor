import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function extractErrorMessage(err, fallback = 'An unexpected error occurred.') {
  if (err?.response?.data?.detail) {
    const detail = err.response.data.detail;
    return typeof detail === 'string' ? detail : JSON.stringify(detail);
  }
  if (err?.message) {
    if (err.message.includes('Network Error')) {
      return 'Cannot reach PhishGuard backend API. Ensure FastAPI is running on port 8000.';
    }
    return err.message;
  }
  return fallback;
}

export const phishguardApi = {
  // Health & Dashboard / Analytics
  getHealth: () => apiClient.get('/api/health').then((r) => r.data),
  getDashboard: () => apiClient.get('/api/dashboard').then((r) => r.data),
  getAnalytics: () => apiClient.get('/api/analytics').then((r) => r.data),

  // URL Scanner & History
  extractFeatures: (url) => apiClient.post('/api/scan/features', { url }).then((r) => r.data),
  scanUrl: (url, resolveDns = true) =>
    apiClient.post('/api/scan', { url, resolve_dns: resolveDns }).then((r) => r.data),
  getScanHistory: (params = {}) =>
    apiClient.get('/api/scan/history', { params }).then((r) => r.data),
  getScanById: (id) => apiClient.get(`/api/scan/${id}`).then((r) => r.data),
  deleteScan: (id) => apiClient.delete(`/api/scan/${id}`).then((r) => r.data),

  // Threat Intelligence
  queryVirusTotal: (indicator, indicatorType = 'domain') =>
    apiClient
      .get('/api/threat-intelligence/virustotal', {
        params: { indicator, indicator_type: indicatorType },
      })
      .then((r) => r.data),
  queryURLhaus: (indicator, indicatorType = 'url') =>
    apiClient
      .get('/api/threat-intelligence/urlhaus', {
        params: { indicator, indicator_type: indicatorType },
      })
      .then((r) => r.data),
  queryAbuseIPDB: (ip, maxAgeDays = 90) =>
    apiClient
      .get('/api/threat-intelligence/abuseipdb', {
        params: { ip, max_age_days: maxAgeDays },
      })
      .then((r) => r.data),
  listIndicators: (params = {}) =>
    apiClient.get('/api/threat-intelligence/indicators', { params }).then((r) => r.data),
  addIndicator: (payload) =>
    apiClient.post('/api/threat-intelligence/indicators', payload).then((r) => r.data),

  // Threat Correlation
  correlateThreat: (url, scanId = null, resolveDns = true) =>
    apiClient
      .post('/api/threat-correlation', { url, scan_id: scanId, resolve_dns: resolveDns })
      .then((r) => r.data),
  getCorrelationHistory: (limit = 25) =>
    apiClient.get('/api/threat-correlation/history', { params: { limit } }).then((r) => r.data),

  // Reports
  listReports: () => apiClient.get('/api/reports').then((r) => r.data),
  generateReport: (payload) => apiClient.post('/api/reports/generate', payload).then((r) => r.data),
  getReportDownloadUrl: (reportId) => `${API_BASE_URL}/api/reports/${reportId}/download`,
  getCsvExportUrl: () => `${API_BASE_URL}/api/reports/export/csv`,

  // Settings
  getSettings: () => apiClient.get('/api/settings').then((r) => r.data),
  updateProfile: (payload) => apiClient.put('/api/settings/profile', payload).then((r) => r.data),
  updatePreferences: (payload) =>
    apiClient.put('/api/settings/preferences', payload).then((r) => r.data),
  getSystemStatus: () => apiClient.get('/api/settings/status').then((r) => r.data),
  testConnections: () => apiClient.post('/api/settings/test-connections').then((r) => r.data),
  logout: () => apiClient.post('/api/auth/logout').then((r) => r.data),
};
