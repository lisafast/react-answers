import ContextService from '../ContextService.js';
import { getProviderApiUrl, getApiUrl } from '../../utils/apiToUrl.js';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// Mock LoggingService to avoid auth and network calls
vi.mock('../ClientLoggingService.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock fetch globally for all tests
global.fetch = vi.fn();

describe('ContextService', () => {
  beforeAll(() => {
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
  });
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('prepareMessage', () => {
    it('should prepare message with all parameters', async () => {
      const result = await ContextService.prepareMessage(
        'test message',
        'en',
        'department1',
        'https://referrer.com',
        ['result1'],
        'google',
        []
      );

      expect(result).toEqual({
        message: 'test message\n<referring-url>https://referrer.com</referring-url>',
        systemPrompt: expect.any(String),
        searchResults: ['result1'],
        searchProvider: 'google',
        conversationHistory: [],
        referringUrl: 'https://referrer.com',
        chatId: 'system',
      });
    });

    it('should prepare message without optional parameters', async () => {
      const result = await ContextService.prepareMessage('test message');

      expect(result).toEqual({
        message: 'test message',
        systemPrompt: expect.any(String),
        searchResults: null,
        searchProvider: null,
        conversationHistory: [],
        referringUrl: '',
        chatId: 'system',
      });
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const mockResponse = {
        content: 'response message',
        model: 'claude-2',
        inputTokens: 100,
        outputTokens: 50,
      };

      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const result = await ContextService.sendMessage(
        'anthropic',
        'test message',
        'en',
        'department1',
        'https://referrer.com',
        ['search result'],
        'google',
        []
      );

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        getProviderApiUrl('anthropic', 'context'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        })
      );
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.chatId).toBe('system');
    });

    it('should handle API errors', async () => {
      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Server error'),
        })
      );

      await expect(ContextService.sendMessage('anthropic', 'test message')).rejects.toThrow(
        'HTTP error! status: 500'
      );
    });
  });

  describe('contextSearch', () => {
    it('should perform search successfully', async () => {
      const mockSearchResults = { results: ['result1', 'result2'] };

      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSearchResults),
        })
      );

      const result = await ContextService.contextSearch('search query', 'google');

      expect(result).toEqual(mockSearchResults);
      expect(fetch).toHaveBeenCalledWith(
        getApiUrl('search-context'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'search query',
            lang: 'en',
            searchService: 'google',
            chatId: 'system',
          }),
        })
      );
    });
  });

  describe('parseContext', () => {
    it('should parse context with all fields', () => {
      const mockContext = {
        message:
          '<topic>Test Topic</topic><topicUrl>https://example.com</topicUrl><department>Test Dept</department><departmentUrl>https://dept.com</departmentUrl>',
        searchResults: ['result1'],
        searchProvider: 'google',
        model: 'claude-2',
        inputTokens: 100,
        outputTokens: 50,
      };

      const result = ContextService.parseContext(mockContext);

      expect(result).toEqual({
        topic: 'Test Topic',
        topicUrl: 'https://example.com',
        department: 'Test Dept',
        departmentUrl: 'https://dept.com',
        searchResults: ['result1'],
        searchProvider: 'google',
        model: 'claude-2',
        inputTokens: 100,
        outputTokens: 50,
      });
    });

    it('should handle missing fields', () => {
      const mockContext = {
        message: '<topic>Test Topic</topic>',
        searchResults: [],
        model: 'claude-2',
      };

      const result = ContextService.parseContext(mockContext);

      expect(result).toEqual({
        topic: 'Test Topic',
        topicUrl: null,
        department: null,
        departmentUrl: null,
        searchResults: [],
        searchProvider: undefined,
        model: 'claude-2',
        inputTokens: undefined,
        outputTokens: undefined,
      });
    });
  });
});
