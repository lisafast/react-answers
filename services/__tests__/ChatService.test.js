import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatService, RedactionError } from '../ChatService.js';
import RedactionService from '../../src/services/RedactionService.js';
import ClientLoggingService from '../../src/services/ClientLoggingService.js';

vi.mock('../../src/services/RedactionService.js', () => ({
  default: {
    ensureInitialized: vi.fn(),
    redactText: vi.fn()
  }
}));

vi.mock('../../src/services/ClientLoggingService.js', () => ({
  default: {
    info: vi.fn()
  }
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn()
};
global.localStorage = localStorageMock;

describe('ChatService', () => {
  const mockParams = {
    chatId: 'test-chat-id',
    userMessage: 'Hello, how are you?',
    aiMessageId: 'msg-123',
    messages: [],
    lang: 'en',
    selectedDepartment: 'general',
    referringUrl: 'http://example.com',
    selectedAI: 'gpt4',
    t: vi.fn(),
    updateStatusWithTimer: vi.fn(),
    selectedSearch: 'default'
  };

  beforeEach(() => {
    RedactionService.ensureInitialized = vi.fn().mockResolvedValue();
    RedactionService.redactText = vi.fn().mockReturnValue({
      redactedText: 'Hello, how are you?',
      redactedItems: []
    });
    ClientLoggingService.info = vi.fn().mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processResponse', () => {
    it('should process a message successfully', async () => {
      const { chatId, userMessage, aiMessageId, messages, lang, selectedDepartment, 
        referringUrl, selectedAI, t, updateStatusWithTimer, selectedSearch } = mockParams;

      const result = await ChatService.processResponse(
        chatId,
        userMessage,
        aiMessageId,
        messages,
        lang,
        selectedDepartment,
        referringUrl,
        selectedAI,
        t,
        updateStatusWithTimer,
        selectedSearch
      );

      expect(RedactionService.ensureInitialized).toHaveBeenCalled();
      expect(RedactionService.redactText).toHaveBeenCalledWith(userMessage);
      expect(ClientLoggingService.info).toHaveBeenCalledWith(
        chatId,
        'Starting pipeline with data:',
        expect.any(Object)
      );
      expect(result).toBeDefined();
    });

    it('should throw RedactionError for blocked content', async () => {
      RedactionService.redactText.mockReturnValue({
        redactedText: 'Hello, how are you? #blocked#',
        redactedItems: ['blocked']
      });

      const { chatId, userMessage, aiMessageId, messages, lang, selectedDepartment, 
        referringUrl, selectedAI, t, updateStatusWithTimer, selectedSearch } = mockParams;

      await expect(ChatService.processResponse(
        chatId,
        userMessage,
        aiMessageId,
        messages,
        lang,
        selectedDepartment,
        referringUrl,
        selectedAI,
        t,
        updateStatusWithTimer,
        selectedSearch
      )).rejects.toThrow(RedactionError);
    });
  });

  describe('processRedaction', () => {
    it('should process text without blocked content', async () => {
      const result = await ChatService.processRedaction('Hello, how are you?');
      expect(RedactionService.ensureInitialized).toHaveBeenCalled();
      expect(RedactionService.redactText).toHaveBeenCalledWith('Hello, how are you?');
      expect(result).toBeUndefined();
    });

    it('should throw RedactionError for text with blocked content', async () => {
      RedactionService.redactText.mockReturnValue({
        redactedText: 'Hello #blocked# XXX',
        redactedItems: ['blocked']
      });

      await expect(ChatService.processRedaction('Hello blocked XXX'))
        .rejects.toThrow(RedactionError);
    });
  });

  describe('onStatusUpdate', () => {
    it('should log status update correctly', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const mockStatus = 'PROCESSING';
      
      ChatService.onStatusUpdate(mockStatus);
      expect(consoleSpy).toHaveBeenCalledWith('Status updated to: PROCESSING');
      
      consoleSpy.mockRestore();
    });
  });
});