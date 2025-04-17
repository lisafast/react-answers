import { describe, it, expect, vi } from 'vitest';
import { urlValidator } from '../urlValidator.js';

// Mock translation function
const t = (key) => key;

// Mock menu structure for fallback logic
vi.mock('../data/menuStructure/menuStructure_EN.js', () => ({
  menuStructure_EN: {
    main: { url: 'https://www.canada.ca/en/main.html', mostRequested: { foo: 'https://www.canada.ca/en/foo.html' } },
    about: { url: 'https://www.canada.ca/en/about.html', mostRequested: { bar: 'https://www.canada.ca/en/bar.html' } },
  },
}));
vi.mock('../data/menuStructure/menuStructure_FR.js', () => ({
  menuStructure_FR: {
    principal: { url: 'https://www.canada.ca/fr/principal.html', mostRequested: { foo: 'https://www.canada.ca/fr/foo.html' } },
  },
}));

// Mock urlChecker.js (checkCitationUrl)
vi.mock('../urlChecker.js', () => ({
  default: vi.fn(async (url) => {
    if (url === 'https://www.canada.ca/en/main.html') {
      return { isValid: true, url, confidenceRating: 1.0 };
    }
    if (url === 'https://www.canada.ca/en/foo.html') {
      return { isValid: false };
    }
    if (url === 'https://www.canada.ca/en/unknown.html') {
      return { isValid: false };
    }
    // fallback for other URLs
    return { isValid: false };
  })
}));

describe('urlValidator', () => {
  it('returns valid for non-404 canada.ca url', async () => {
    const url = 'https://www.canada.ca/en/main.html';
    const result = await urlValidator.validateAndCheckUrl(url, 'en', t);
    expect(result.isValid).toBe(true);
    expect(result.url).toBe(url);
    expect(result.confidenceRating).toBe('1.0');
  });

  it('returns fallback from menu for 404 url with good match', async () => {
    const url = 'https://www.canada.ca/en/foo.html';
    const result = await urlValidator.validateAndCheckUrl(url, 'en', t);
    expect(result.isValid).toBe(false); // fallback, not valid
    expect(typeof result.fallbackUrl).toBe('string');
    expect(result.fallbackUrl.length).toBeGreaterThan(0);
    expect(Number(result.confidenceRating)).toBeGreaterThan(0);
  });

  it('returns search fallback for 404 url with no good match', async () => {
    const url = 'https://www.canada.ca/en/unknown.html';
    const result = await urlValidator.validateAndCheckUrl(url, 'en', t);
    expect(result.isValid).toBe(false);
    expect(result.fallbackUrl).toContain('srb.html');
    expect(result.confidenceRating).toBe('0.1');
  });

  it('getFallbackUrl returns best match from menu', () => {
    const url = 'https://www.canada.ca/en/foo.html';
    const result = urlValidator.getFallbackUrl(url, 'en');
    expect(typeof result.url).toBe('string');
    expect(result.url.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
  });
});
