
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import handler from '../chat.js';
import ChatProcessingService from '../../services/ChatProcessingService.js';
import statusEmitter from '../../../utils/statusEmitter.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.dropDatabase();
  }
});

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
    // Always mock processMessage to resolve by default
    ChatProcessingService.processMessage.mockImplementation(() => Promise.resolve());
  });

  it('returns 405 for non-POST requests', async () => {
    const socket = { remoteAddress: '127.0.0.1' };
    const req = { method: 'GET', headers: {}, socket, connection: socket };
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ message: 'Method GET Not Allowed' });
  });

  it('returns error if required fields are missing', async () => {
    const socket = { remoteAddress: '127.0.0.1' };
    const req = { method: 'POST', body: {}, headers: {}, socket, connection: socket };
    const res = createMockRes();
    await handler(req, res);
    expect(res.getData()).toContain('Missing required fields');
    expect(res.writableEnded).toBe(true);
  });

  it('includes requestId in processParams and sets up SSE', async () => {
    const socket = { remoteAddress: '127.0.0.1' };
    const req = {
      method: 'POST',
      headers: { 'user-agent': 'test-agent' },
      socket,
      connection: socket,
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
    // Ensure the mock is set for this test
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
    const socket = { remoteAddress: '127.0.0.1' };
    const req = {
      method: 'POST',
      headers: { 'user-agent': 'test-agent' },
      socket,
      connection: socket,
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
    // Ensure the mock emits processing_complete and does not throw
    ChatProcessingService.processMessage.mockImplementation(async () => {
      const eventName = Object.keys(statusEmitter._events).find(e => e.startsWith('statusUpdate:'));
      statusEmitter.emit(eventName, { type: 'processing_complete', data: { done: true } });
    });
    await handler(req, res);
    expect(res.writableEnded).toBe(true);
    expect(res.getData()).toContain('event: processing_complete');
  });
});
