import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ContextTool } from '../tools/ContextTool.js';
import ContextService from '../../services/ContextService.js';
// No longer need to mock loadContextSystemPrompt here
// import loadContextSystemPrompt from '../../src/services/contextSystemPrompt.js';
import { invokeContextAgent } from '../contextAgentInvoker.js';

// Mock dependencies
vi.mock('../../src/services/ContextService.js');
// vi.mock('../../src/services/contextSystemPrompt.js'); // Remove mock
vi.mock('../contextAgentInvoker.js');

describe('ContextTool', () => {
  let contextTool;
  const mockChatId = 'test-chat-123';
  const mockAiProvider = 'openai';

  beforeEach(() => {
    vi.resetAllMocks();
    // Mock implementations
    ContextService.contextSearch = vi.fn().mockResolvedValue({ results: 'mock search results' });
    // loadContextSystemPrompt = vi.fn().mockResolvedValue('mock system prompt'); // Remove mock setup
    invokeContextAgent = vi.fn().mockResolvedValue({
      topic: 'Mock Topic',
      topicUrl: 'http://mock.topic.url',
      department: 'Mock Dept',
      departmentUrl: 'http://mock.dept.url',
      searchResults: 'mock search results',
      searchProvider: 'google',
      model: 'gpt-test',
      inputTokens: 10,
      outputTokens: 20,
      tools: [{ tool: 'contextSearch', input: 'query', output: 'results' }],
    });

    // Instantiate the renamed tool
    contextTool = new ContextTool({ aiProvider: mockAiProvider, chatId: mockChatId });
  });

  it('should be defined', () => {
    expect(ContextTool).toBeDefined();
  });

  it('should have name and description', () => {
    expect(contextTool.name).toBe('getContext');
    expect(contextTool.description).toBeDefined();
    expect(typeof contextTool.description).toBe('string');
  });

  it('should define input schema correctly', () => {
    expect(contextTool.schema).toBeDefined();
    const shape = contextTool.schema.shape;
    expect(shape.query).toBeDefined();
    expect(shape.lang).toBeDefined();
    expect(shape.department).toBeDefined();
    expect(shape.referringUrl).toBeDefined();
    expect(shape.searchProvider).toBeDefined();
    expect(shape.conversationHistory).toBeDefined();
  });

  it('should call dependencies and return context on _call', async () => {
    const input = {
      query: 'test query',
      lang: 'en',
      department: 'test dept',
      referringUrl: 'http://test.url',
      searchProvider: 'google',
      conversationHistory: [],
    };

    const expectedContext = {
      topic: 'Mock Topic',
      topicUrl: 'http://mock.topic.url',
      department: 'Mock Dept',
      departmentUrl: 'http://mock.dept.url',
      searchResults: 'mock search results',
      searchProvider: 'google',
      model: 'gpt-test',
      inputTokens: 10,
      outputTokens: 20,
      tools: [{ tool: 'contextSearch', input: 'query', output: 'results' }],
    };

    const result = await contextTool._call(input);

    expect(ContextService.contextSearch).toHaveBeenCalledWith(
      input.query,
      input.searchProvider,
      input.lang,
      mockChatId
    );
    // Verify loadContextSystemPrompt is NOT called
    // Cannot assert not called if not mocked/imported

    // Verify invokeContextAgent is called with updated arguments
    expect(invokeContextAgent).toHaveBeenCalledWith(
      mockAiProvider,
      {
        message: input.query,
        // systemPrompt: 'mock system prompt', // Removed
        searchResults: 'mock search results',
        searchProvider: input.searchProvider,
        lang: input.lang, // Check lang is passed
        department: input.department, // Check department is passed
        conversationHistory: input.conversationHistory, // Check history is passed
        chatId: mockChatId,
      }
    );
    expect(result).toEqual(expectedContext);
  });

  it('should handle missing optional parameters', async () => {
     const input = {
      query: 'minimal query',
      searchProvider: 'canadaca',
      // lang, department, referringUrl, conversationHistory are omitted
    };

     await contextTool._call(input);

     // Verify contextSearch call (lang is undefined as test bypasses Zod)
     expect(ContextService.contextSearch).toHaveBeenCalledWith(
      input.query,
      input.searchProvider,
      undefined,
      mockChatId
    );

    // Verify loadContextSystemPrompt is NOT called
    // Cannot assert not called if not mocked/imported

    // Verify invokeContextAgent is called with updated arguments (including undefined lang/dept/history)
    expect(invokeContextAgent).toHaveBeenCalledWith(
      mockAiProvider,
      expect.objectContaining({
        message: input.query,
        searchProvider: input.searchProvider,
        lang: undefined, // Expect undefined lang
        department: undefined, // Expect undefined department
        conversationHistory: undefined, // Expect undefined history
        chatId: mockChatId,
      })
    );
  });

});
