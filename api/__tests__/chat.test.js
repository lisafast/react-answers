import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler from '../chat.js';
import { ChatService } from '../../src/services/ChatService.js';

vi.mock('../../src/services/ChatService.js', () => ({
  ChatService: {
    processResponse: vi.fn()
  }
}));

describe('Chat API Handler', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      body: {
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
      }
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
      end: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 405 for non-POST requests', async () => {
    mockReq.method = 'GET';
    await handler(mockReq, mockRes);

    expect(mockRes.setHeader).toHaveBeenCalledWith('Allow', ['POST']);
    expect(mockRes.status).toHaveBeenCalledWith(405);
    expect(mockRes.end).toHaveBeenCalledWith('Method GET Not Allowed');
  });

  it('should process a valid chat request successfully', async () => {
    const mockResponse = {
      content: 'Hello! I am doing well.',
      context: { topic: 'greeting' },
      question: 'Hello, how are you?',
      citationUrl: 'http://example.com/citation',
      confidenceRating: 0.9
    };

    ChatService.processResponse.mockResolvedValueOnce(mockResponse);

    await handler(mockReq, mockRes);

    expect(ChatService.processResponse).toHaveBeenCalledWith(
      mockReq.body.chatId,
      mockReq.body.userMessage,
      mockReq.body.aiMessageId,
      mockReq.body.messages,
      mockReq.body.lang,
      mockReq.body.selectedDepartment,
      mockReq.body.referringUrl,
      mockReq.body.selectedAI,
      mockReq.body.t,
      mockReq.body.updateStatusWithTimer,
      mockReq.body.selectedSearch
    );

    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith(mockResponse);
  });

  it('should handle errors appropriately', async () => {
    const error = new Error('Processing failed');
    ChatService.processResponse.mockRejectedValueOnce(error);

    await handler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Error processing chat',
      error: 'Processing failed'
    });
  });

  it('should handle RedactionError appropriately', async () => {
    const error = new RedactionError('Redaction failed', 'redacted text', ['item1', 'item2']);
    ChatService.processResponse.mockRejectedValueOnce(error);

    await handler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Error processing chat',
      error: 'Redaction failed',
      isRedactionError: true,
      redactedText: 'redacted text',
      redactedItems: ['item1', 'item2']
    });
    expect(console.error).toHaveBeenCalledWith('Error processing chat:', error);
  });
});
