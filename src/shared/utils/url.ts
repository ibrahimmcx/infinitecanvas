const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

const RESTRICTED_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'brave://',
  'opera://',
  'vivaldi://',
  'devtools://',
  'view-source:',
  'file://',
];

export function isRestrictedUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim().toLowerCase();
  if (!trimmed) return true;
  return RESTRICTED_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export function normalizeExternalUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const candidate =
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      if (parsed.hostname !== 'localhost') {
        return null;
      }
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isValidExternalUrl(rawUrl: string): boolean {
  return normalizeExternalUrl(rawUrl) !== null;
}

export function extractDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return rawUrl;
  }
}

export function sanitizeFaviconUrl(favicon: string | undefined): string {
  if (!favicon) return '';
  const trimmed = favicon.trim();
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export function getGoogleFaviconFallback(rawUrl: string): string {
  const domain = extractDomain(rawUrl);
  if (!domain || domain === rawUrl) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}
