import { describe, it, expect, vi } from 'vitest';
import { urlToSearch } from '../urlToSearch.js';

const t = (key) => key;

describe('urlToSearch', () => {
  it('returns fallback for empty url', async () => {
    const result = await urlToSearch.validateAndCheckUrl('', 'en', 'my question', undefined, t);
    expect(result.isValid).toBe(false);
    expect(result.fallbackUrl).toContain('srb.html');
    expect(result.confidenceRating).toBe('0.1');
  });

  it('returns valid for non-canada.ca url', async () => {
    const url = 'https://example.com/page';
    const result = await urlToSearch.validateAndCheckUrl(url, 'en', 'q', undefined, t);
    expect(result.isValid).toBe(true);
    expect(result.url).toBe(url);
  });

  it('returns valid for valid canada.ca url', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ url: 'https://www.canada.ca/en/page', status: 200 }));
    const url = 'https://www.canada.ca/en/page';
    const result = await urlToSearch.validateAndCheckUrl(url, 'en', 'q', undefined, t);
    expect(result.isValid).toBe(true);
    expect(result.url).toBe(url);
    expect(Number(result.confidenceRating)).toBeGreaterThan(0.5);
    vi.unstubAllGlobals();
  });

  it('returns fallback for 404 canada.ca url', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ url: 'https://www.canada.ca/errors/404.html', status: 404 }));
    const url = 'https://www.canada.ca/en/404';
    const result = await urlToSearch.validateAndCheckUrl(url, 'en', 'q', undefined, t);
    expect(result.isValid).toBe(false);
    expect(result.fallbackUrl).toContain('srb.html');
    vi.unstubAllGlobals();
  });

  it('generates department-specific fallback', () => {
    const result = urlToSearch.generateFallbackSearchUrl('en', 'taxes', 'cra', t);
    expect(result.fallbackUrl).toContain('revenue-agency');
    expect(result.fallbackUrl).toContain('taxes');
  });
});
