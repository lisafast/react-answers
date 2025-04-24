import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../chat.js';
import ChatProcessingService from '../../services/ChatProcessingService.js';
import statusEmitter from '../../../utils/statusEmitter.js';

vi.mock('../../services/ChatProcessingService.js', () => ({
  default: { processMessage: vi.fn() }
}));

function createMockRes() {
  let data = '';
  return {
    statusCode: 200,
    headers: {},
    writableEnded: false,
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    write(chunk) {
      data += chunk;
    },
    end() {
      this.writableEnded = true;
    },
    getData() {
      return data;
    },
    on: vi.fn()
  };
}

describe('api/chat/chat.js SSE handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 for non-POST requests', async () => {
    const req = { method: 'GET', headers: {} }; // Add headers
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ message: 'Method GET Not Allowed' });
  });

  it('returns error if required fields are missing', async () => {
    const req = { method: 'POST', body: {}, headers: {} }; // Add headers
    const res = createMockRes();
    await handler(req, res);
    expect(res.getData()).toContain('Missing required fields');
    expect(res.writableEnded).toBe(true);
  });

  it('includes requestId in processParams and sets up SSE', async () => {
    const req = {
      method: 'POST',
      headers: { 'user-agent': 'test-agent' }, // Add headers
      body: {
        chatId: 'chat1',
        userMessage: 'Hello',
        lang: 'en',
        referringUrl: 'http://test.com',
        selectedAI: 'gpt',
        selectedSearch: 'default'
      }
    };
    const res = createMockRes();
    ChatProcessingService.processMessage.mockResolvedValueOnce();
    await handler(req, res);
    const params = ChatProcessingService.processMessage.mock.calls[0][0];
    expect(params.requestId).toBeDefined();
    expect(typeof params.requestId).toBe('string');
    expect(params.chatId).toBe('chat1');
    expect(res.headers['Content-Type']).toBe('text/event-stream');
    expect(res.headers['Cache-Control']).toBe('no-cache');
    expect(res.headers['Connection']).toBe('keep-alive');
  });

  it('cleans up SSE and ends response on processing_complete event', async () => {
    const req = {
      method: 'POST',
      headers: { 'user-agent': 'test-agent' }, // Add headers
      body: {
        chatId: 'chat1',
        userMessage: 'Hello',
        lang: 'en',
        referringUrl: 'http://test.com',
        selectedAI: 'gpt',
        selectedSearch: 'default'
      }
    };
    const res = createMockRes();
    ChatProcessingService.processMessage.mockImplementation(async () => {
      const eventName = Object.keys(statusEmitter._events).find(e => e.startsWith('statusUpdate:'));
      statusEmitter.emit(eventName, { type: 'processing_complete', data: { done: true } });
    });
    await handler(req, res);
    expect(res.writableEnded).toBe(true);
    expect(res.getData()).toContain('event: processing_complete');
  });
});
