import { describe, expect, it } from 'vitest';
import {
  extractDomain,
  isRestrictedUrl,
  isValidExternalUrl,
  normalizeExternalUrl,
  sanitizeFaviconUrl,
} from '@/shared/utils/url';

describe('URL validation and sanitization', () => {
  it('accepts valid http and https URLs and normalizes bare domains', () => {
    expect(normalizeExternalUrl('https://github.com/facebook/react')).toBe(
      'https://github.com/facebook/react'
    );
    expect(normalizeExternalUrl('example.com/docs')).toBe('https://example.com/docs');
    expect(normalizeExternalUrl('http://localhost:3000/test')).toBe('http://localhost:3000/test');
    expect(isValidExternalUrl('https://reactflow.dev')).toBe(true);
  });

  it('rejects unsafe protocols and invalid strings', () => {
    expect(normalizeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(normalizeExternalUrl('chrome://extensions')).toBeNull();
    expect(normalizeExternalUrl('file:///etc/passwd')).toBeNull();
    expect(normalizeExternalUrl('   ')).toBeNull();
    expect(isValidExternalUrl('not-a-domain')).toBe(false);
  });

  it('detects restricted browser URLs', () => {
    expect(isRestrictedUrl('chrome://settings')).toBe(true);
    expect(isRestrictedUrl('chrome-extension://abc/canvas.html')).toBe(true);
    expect(isRestrictedUrl('about:blank')).toBe(true);
    expect(isRestrictedUrl('https://developer.chrome.com')).toBe(false);
  });

  it('extracts clean domains without www prefix', () => {
    expect(extractDomain('https://www.linear.app/features')).toBe('linear.app');
    expect(extractDomain('https://docs.github.com')).toBe('docs.github.com');
  });

  it('sanitizes favicon URLs against javascript injection', () => {
    expect(sanitizeFaviconUrl('https://example.com/favicon.ico')).toBe(
      'https://example.com/favicon.ico'
    );
    expect(sanitizeFaviconUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(sanitizeFaviconUrl('javascript:alert(1)')).toBe('');
  });
});
