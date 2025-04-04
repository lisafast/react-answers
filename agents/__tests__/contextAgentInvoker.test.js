// filepath: c:\Users\hymary\repo\answers\react-answers\agents\__tests__\contextAgentInvoker.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invokeContextAgent } from '../contextAgentInvoker.js';
import { createContextAgent } from '../agentFactory.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';
import { ToolTrackingHandler } from '../ToolTrackingHandler.js';

vi.mock('../agentFactory.js');
vi.mock('../../services/ServerLoggingService.js', () => ({
    default: {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
    }
}));

describe('contextAgentInvoker', () => {
    let mockAgent;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAgent = {
            invoke: vi.fn(),
            callbacks: [],
        };
    });

    it('should include tool usage in the response', async () => {
        const testChatId = 'test-chat-id';
        // Create an actual ToolTrackingHandler instance
        const toolTrackingHandler = new ToolTrackingHandler(testChatId);
        toolTrackingHandler.getToolUsageSummary = vi.fn().mockReturnValue({
            'test-tool': { count: 1 },
        });

        mockAgent.callbacks = [toolTrackingHandler];
        mockAgent.invoke.mockResolvedValue({
            messages: [{
                content: 'This is a test response',
                response_metadata: {
                    tokenUsage: {
                        promptTokens: 10,
                        completionTokens: 20,
                    },
                    model_name: 'test-model',
                },
            }],
        });

        createContextAgent.mockResolvedValue(mockAgent);

        const testRequest = {
            chatId: testChatId,
            message: 'test message',
            systemPrompt: 'test prompt',
            searchResults: { results: 'test results' },
            searchProvider: 'google',
        };

        const result = await invokeContextAgent('openai', testRequest);

        expect(result).toEqual({
            message: 'This is a test response',
            inputTokens: 10,
            outputTokens: 20,
            model: 'test-model',
            searchProvider: 'google',
            searchResults: { results: 'test results' },
            tools: {
                'test-tool': { count: 1 },
            },
        });

        // Verify logging occurred
        expect(ServerLoggingService.info).toHaveBeenCalledWith(
            'ContextAgent Response:',
            testChatId,
            expect.any(Object)
        );
        expect(ServerLoggingService.debug).toHaveBeenCalledWith(
            'Tool usage summary:',
            testChatId,
            expect.any(Object)
        );
    });

    it('should handle case when no tool tracking handler is available', async () => {
        mockAgent.invoke.mockResolvedValue({
            messages: [{
                content: 'This is a test response',
                response_metadata: {
                    role: 'assistant',
                },
            }],
        });

        createContextAgent.mockResolvedValue(mockAgent);

        const testRequest = {
            chatId: 'test-chat-id',
            message: 'test message',
            systemPrompt: 'test prompt',
            searchResults: { results: 'test results' },
            searchProvider: 'google',
        };

        const result = await invokeContextAgent('openai', testRequest);

        expect(result.tools).toEqual({});
    });

    it('should handle errors during agent invocation', async () => {
        mockAgent.invoke.mockRejectedValue(new Error('Test error'));
        createContextAgent.mockResolvedValue(mockAgent);

        const testRequest = {
            chatId: 'test-chat-id',
            message: 'test message',
            systemPrompt: 'test prompt',
            searchResults: { results: 'test results' },
            searchProvider: 'google',
        };
        
        // Expect the function to throw an error
        await expect(invokeContextAgent('openai', testRequest)).rejects.toThrow('Test error');
        
        // Verify error was logged with ServerLoggingService
        expect(ServerLoggingService.error).toHaveBeenCalledWith(
            'Error with openai agent:',
            'test-chat-id',
            expect.any(Error)
        );
    });

    it('should handle case when agent creation fails', async () => {
        createContextAgent.mockResolvedValue(null);

        const testRequest = {
            chatId: 'test-chat-id',
            message: 'test message',
            systemPrompt: 'test prompt',
            searchResults: { results: 'test results' },
            searchProvider: 'google',
        };
        
        // Expect the function to throw an error
        await expect(invokeContextAgent('openai', testRequest)).rejects.toThrow('Context agent creation failed.');
        
        // Verify error was logged with ServerLoggingService
        expect(ServerLoggingService.error).toHaveBeenCalledWith(
            'Failed to create context agent for type openai and provider google.',
            'test-chat-id'
        );
    });
});