export function formatRelativeTime(isoString) {
  if (!isoString) return 'Just now';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec} sec ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatNumber(value) {
  const num = Number(value || 0);
  return num.toLocaleString('en-US');
}

export function validateClientUrl(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return 'Please enter a URL to scan.';
  if (trimmed.length > 2048) return 'URL is too long (maximum 2,048 characters).';
  if (/\s/.test(trimmed)) return 'URL must not contain spaces.';

  const badScheme = /^(javascript|data|file|ftp|vbscript):/i;
  if (badScheme.test(trimmed)) {
    return 'Unsupported URL scheme. Only http:// and https:// URLs are allowed.';
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return 'Enter a valid domain name or public IP (e.g., https://example.com).';
    }
    const lowerHost = parsed.hostname.toLowerCase();
    if (
      lowerHost === 'localhost' ||
      lowerHost === '127.0.0.1' ||
      lowerHost === '0.0.0.0' ||
      lowerHost.startsWith('192.168.') ||
      lowerHost.startsWith('10.') ||
      lowerHost === '169.254.169.254'
    ) {
      return 'Internal, localhost, and private network addresses are blocked for security.';
    }
  } catch {
    return 'Invalid URL syntax. Example: https://example.com/login';
  }
  return null;
}

export function getRiskColor(score) {
  if (score >= 82) return { text: 'text-red-700', bg: 'bg-red-600', light: 'bg-red-50', border: 'border-red-200' };
  if (score >= 62) return { text: 'text-rose-700', bg: 'bg-rose-500', light: 'bg-rose-50', border: 'border-rose-200' };
  if (score >= 34) return { text: 'text-amber-700', bg: 'bg-amber-500', light: 'bg-amber-50', border: 'border-amber-200' };
  return { text: 'text-emerald-700', bg: 'bg-emerald-500', light: 'bg-emerald-50', border: 'border-emerald-200' };
}
