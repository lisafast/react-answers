import { describe, it, expect, vi } from 'vitest';
import checkCitationUrl from '../urlChecker.js';

// Mock fetch for network requests
const originalFetch = global.fetch;

describe('checkCitationUrl', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns null for empty url', async () => {
    expect(await checkCitationUrl('')).toBeNull();
  });

  it('returns valid for non-canada.ca url', async () => {
    const url = 'https://example.com/page';
    expect(await checkCitationUrl(url)).toEqual({
      isValid: true,
      url,
      confidenceRating: 0.25,
    });
  });

  it('returns isValid true for valid canada.ca url', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      url: 'https://www.canada.ca/en/page',
      status: 200,
    });
    const url = 'https://www.canada.ca/en/page';
    const result = await checkCitationUrl(url);
    expect(result.isValid).toBe(true);
    expect(result.url).toBe(url);
    expect(result.confidenceRating).toBe(1);
  });

  it('returns isValid false for 404 canada.ca url', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      url: 'https://www.canada.ca/errors/404.html',
      status: 404,
    });
    const url = 'https://www.canada.ca/en/404';
    const result = await checkCitationUrl(url);
    expect(result.isValid).toBe(false);
  });

  it('returns isValid true with lower confidence for CORS error', async () => {
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('CORS'))
      .mockResolvedValueOnce({});
    const url = 'https://www.canada.ca/en/page';
    const result = await checkCitationUrl(url);
    expect(result.isValid).toBe(true);
    expect(result.confidenceRating).toBe(0.75);
  });

  it('returns isValid false for network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const url = 'https://www.canada.ca/en/page';
    const result = await checkCitationUrl(url);
    expect(result.isValid).toBe(false);
  });
});
