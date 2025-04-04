import { describe, it, expect, afterEach } from 'vitest';
import { getApiUrl, getProviderApiUrl, providerOrder } from '../apiToUrl';

describe('apiToUrl utility functions', () => {
  // Store original NODE_ENV
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    // Restore original NODE_ENV after each test
    process.env.NODE_ENV = originalEnv;
  });

  describe('getApiUrl', () => {
    it('should return the correct URL in development mode', () => {
      process.env.NODE_ENV = 'development';
      const endpoint = 'db-connect';
      const expectedUrl = 'http://127.0.0.1:3001/api/db/db-connect';
      expect(getApiUrl(endpoint)).toBe(expectedUrl);
    });

    it('should return the correct URL in production mode', () => {
      process.env.NODE_ENV = 'production';
      const endpoint = 'openai-message';
      const expectedUrl = '/api/openai/openai-message';
      expect(getApiUrl(endpoint)).toBe(expectedUrl);
    });

    it('should handle endpoints with multiple hyphens correctly', () => {
      process.env.NODE_ENV = 'development';
      const endpoint = 'azure-batch-status';
      const expectedUrl = 'http://127.0.0.1:3001/api/azure/azure-batch-status';
      expect(getApiUrl(endpoint)).toBe(expectedUrl);
    });

    it('should handle endpoints without hyphens (using first part as prefix)', () => {
      process.env.NODE_ENV = 'production';
      // Assuming if no hyphen, the whole endpoint is used as prefix and endpoint name
      // Based on the code: prefix = endpoint.split('-')[0]; return `${serverUrl}/api/${prefix}/${endpoint}`;
      const endpoint = 'search';
      const expectedUrl = '/api/search/search'; // prefix becomes 'search'
      expect(getApiUrl(endpoint)).toBe(expectedUrl);
    });
  });

  describe('getProviderApiUrl', () => {
    it('should return the correct URL for "claude" in development mode', () => {
      process.env.NODE_ENV = 'development';
      const provider = 'claude';
      const endpoint = 'message';
      const expectedUrl = 'http://127.0.0.1:3001/api/anthropic/anthropic-message';
      expect(getProviderApiUrl(provider, endpoint)).toBe(expectedUrl);
    });

    it('should return the correct URL for "openai" in production mode', () => {
      process.env.NODE_ENV = 'production';
      const provider = 'openai';
      const endpoint = 'context';
      const expectedUrl = '/api/openai/openai-context';
      expect(getProviderApiUrl(provider, endpoint)).toBe(expectedUrl);
    });

    it('should return the correct URL for "azure" in development mode', () => {
      process.env.NODE_ENV = 'development';
      const provider = 'azure';
      const endpoint = 'batch';
      const expectedUrl = 'http://127.0.0.1:3001/api/azure/azure-batch';
      expect(getProviderApiUrl(provider, endpoint)).toBe(expectedUrl);
    });

    it('should return the correct URL for "azure-openai" in production mode', () => {
      process.env.NODE_ENV = 'production';
      const provider = 'azure-openai';
      const endpoint = 'message';
      const expectedUrl = '/api/azure/azure-message';
      expect(getProviderApiUrl(provider, endpoint)).toBe(expectedUrl);
    });

    it('should handle unknown providers by using the provider name directly', () => {
      process.env.NODE_ENV = 'development';
      const provider = 'unknown-provider';
      const endpoint = 'test';
      // Based on the code, if provider isn't mapped, it's used directly
      const expectedUrl = 'http://127.0.0.1:3001/api/unknown-provider/unknown-provider-test';
      expect(getProviderApiUrl(provider, endpoint)).toBe(expectedUrl);
    });
  });

  describe('providerOrder', () => {
    it('should contain the correct providers in the specified order', () => {
      const expectedOrder = ["openai", "azure", "anthropic", "cohere"];
      expect(providerOrder).toEqual(expectedOrder);
    });
  });
});
