import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createMocks } from 'node-mocks-http';
import openaiMessageHandler from '../openai-message.js';
import * as agentFactory from '../../../agents/agentFactory.js';
import ServerLoggingService from '../../../services/ServerLoggingService.js';
import { ToolTrackingHandler } from '../../../agents/ToolTrackingHandler.js';

// Mock dependencies
vi.mock('../../../services/ServerLoggingService.js');
vi.mock('../../../agents/ToolTrackingHandler.js');
vi.mock('../../../agents/agentFactory.js');

describe('OpenAI Message API Handler', () => {
  const mockChatId = 'api-test-chat-123';
  const mockSystemPrompt = 'Test System Prompt';
  const mockUserMessage = 'User query';
  const mockConversationHistory = [{ 
    interaction: {
      question: 'Previous',
      answer: { content: 'Previous answer' }
    } 
  }];

  // Mock data simulating agent's output
  const mockAgentContext = {
    topic: 'Agent Derived Topic',
    topicUrl: 'http://agent.topic',
    tools: [{ tool: 'getContext' }],
  };
  
  const mockAgentRawResponse = {
    messages: [
      {
        role: 'assistant',
        content: '<answer>Agent answer content</answer>',
        metadata: { context: mockAgentContext },
        response_metadata: {
          tokenUsage: { promptTokens: 10, completionTokens: 5 },
          model_name: 'gpt-agent-model'
        }
      }
    ]
  };

  // Create a mock agent instance with a properly working invoke method
  const mockInvoke = vi.fn().mockResolvedValue(mockAgentRawResponse);
  const mockAgentInstance = {
    invoke: mockInvoke,
    callbacks: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    
    // Create a proper mock for the createMessageAgent function
    agentFactory.createMessageAgent.mockImplementation(() => {
      return Promise.resolve(mockAgentInstance);
    });
    
    // Reset the invoke mock to ensure it returns the expected response
    mockInvoke.mockClear();
    mockInvoke.mockResolvedValue(mockAgentRawResponse);
    
    // Mock logger functions
    ServerLoggingService.info = vi.fn();
    ServerLoggingService.error = vi.fn();
    ServerLoggingService.debug = vi.fn();
  });

  it('should call getAgent, invoke agent, and return combined response with content and context', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        message: mockUserMessage,
        conversationHistory: mockConversationHistory,
        systemPrompt: mockSystemPrompt,
        chatId: mockChatId,
      },
    });

    await openaiMessageHandler(req, res);

    // Verify agent creation was called
    expect(agentFactory.createMessageAgent).toHaveBeenCalledWith('openai', mockChatId);

    // Verify agent invocation happened (implicitly checked by getting a 200 response)
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const invokeArgs = mockInvoke.mock.calls[0][0];
     expect(invokeArgs.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'system', content: mockSystemPrompt }),
      // Check history mapping - adjust based on actual convertInteractionsToMessages logic if needed
      expect.objectContaining({ role: 'user', content: 'Previous' }),
      expect.objectContaining({ role: 'assistant', content: 'Previous answer' }),
      expect.objectContaining({ role: 'user', content: mockUserMessage }),
    ]));


    // Verify response sent to client
    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());

    expect(responseData).toBeDefined();
    // Check for answer content (raw content from agent's last message)
    expect(responseData.content).toBe('<answer>Agent answer content</answer>');
    // Check for the context object
    expect(responseData.context).toBeDefined();
    expect(responseData.context.topic).toBe('Agent Derived Topic');
    expect(responseData.context.tools).toEqual(expect.any(Array));
    // Check for other metadata merged from agent response
    expect(responseData.model).toBe('gpt-agent-model');
    expect(responseData.inputTokens).toBe(10);
    expect(responseData.outputTokens).toBe(5);
  });

  it('should handle agent invocation errors and return 500', async () => {
    const agentError = new Error('Agent failed miserably');
    // Ensure createMessageAgent still resolves, but invoke rejects
    agentFactory.createMessageAgent.mockResolvedValue(mockAgentInstance);
    mockInvoke.mockRejectedValue(agentError);

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        message: mockUserMessage,
        conversationHistory: [],
        systemPrompt: mockSystemPrompt,
        chatId: mockChatId,
      },
    });

    await openaiMessageHandler(req, res);

    expect(res._getStatusCode()).toBe(500);
    const responseData = JSON.parse(res._getData());
    expect(responseData.message).toContain('Error processing OpenAI message');
    // The implementation re-throws the original error, check its message
    expect(responseData.error).toBe(agentError.message); // Should be 'Agent failed miserably'
    expect(ServerLoggingService.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing OpenAI message'),
        mockChatId,
        agentError // The original error
    );
  });

  it('should handle missing agent errors and return 500', async () => {
    // Simulate createMessageAgent failing (e.g., returns null or throws)
    const creationError = new Error('Failed to get agent instance'); // Match implementation error
    agentFactory.createMessageAgent.mockRejectedValue(creationError); // Use proper namespace

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        message: mockUserMessage,
        conversationHistory: [],
        systemPrompt: mockSystemPrompt,
        chatId: mockChatId,
      },
    });

    await openaiMessageHandler(req, res);

    expect(res._getStatusCode()).toBe(500);
    const responseData = JSON.parse(res._getData());
    // Check the error message thrown by the implementation
    expect(responseData.message).toContain('Error processing OpenAI message');
    expect(responseData.error).toBe(creationError.message);
    expect(ServerLoggingService.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing OpenAI message'),
        mockChatId,
        creationError
    );
  });
});
