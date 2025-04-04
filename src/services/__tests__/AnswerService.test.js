import { vi, describe, it, expect, beforeEach } from 'vitest';
import AnswerService from '../AnswerService.js';
import loadSystemPrompt from '../systemPrompt.js';
import { getProviderApiUrl } from '../../utils/apiToUrl.js';
import ClientLoggingService from '../ClientLoggingService.js';
// No longer need getAgent here
// import { getAgent } from '../../agents/agentFactory.js';

// Mock dependencies
vi.mock('../systemPrompt.js');
vi.mock('../../utils/apiToUrl.js');
vi.mock('../ClientLoggingService.js');
// No longer mocking agentFactory
// vi.mock('../../agents/agentFactory.js');

// Keep the original implementation of parseResponse for testing its integration
const originalParseResponse = AnswerService.parseResponse;

describe('AnswerService', () => {
  const mockProvider = 'openai';
  const mockMessage = 'Test message';
  const mockConversationHistory = [{ role: 'user', content: 'Previous message' }];
  const mockLang = 'en';
  const mockContextInput = { topic: 'Initial Topic' }; // Context passed *to* prepareMessage initially
  const mockEvaluation = false;
  const mockReferringUrl = 'http://referrer.com';
  const mockChatId = 'chat-123';
  const mockSystemPrompt = 'Mock System Prompt';
  const mockApiUrl = 'http://mock.api/message';

  // Mock data simulating the COMBINED response from the backend API
  const mockApiCombinedResponse = {
      content: '<answer>Final answer text <s-1>Sentence 1.</s-1></answer><citation-url>http://agent.cite</citation-url>', // Raw content from agent
      context: { // Context object derived by agent/tool
          topic: 'Derived Topic by Agent',
          topicUrl: 'http://agent.topic.url',
          department: 'Agent Dept',
          departmentUrl: null,
          searchResults: 'agent search results',
          searchProvider: 'google',
          model: 'agent-context-model',
          inputTokens: 10,
          outputTokens: 20,
          tools: [{ tool: 'getContext', /* ... */ }],
      },
      // Other metadata from backend/agent
      model: 'agent-llm-model',
      inputTokens: 50,
      outputTokens: 25,
      // tools: [] // Tool usage from the *answering* agent might also be here
  };


  beforeEach(() => {
    vi.resetAllMocks();

    // Setup mocks
    loadSystemPrompt.mockResolvedValue(mockSystemPrompt);
    getProviderApiUrl.mockReturnValue(mockApiUrl);
    ClientLoggingService.info = vi.fn();
    ClientLoggingService.debug = vi.fn();
    ClientLoggingService.error = vi.fn();

    // Mock global fetch
    global.fetch = vi.fn(() =>
        Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockApiCombinedResponse),
            text: () => Promise.resolve(JSON.stringify(mockApiCombinedResponse)), // Add text() method
        })
    );

    // Restore original parseResponse for each test
    AnswerService.parseResponse = originalParseResponse;
  });

  describe('sendMessage (API Integration)', () => { // Updated describe block
    it('should call prepareMessage, fetch API, parse response, and return merged result including context', async () => {
      // This test assumes sendMessage uses fetch and processes the combined API response

      // Setup spy *before* calling the function under test
      const prepareMessageSpy = vi.spyOn(AnswerService, 'prepareMessage');

      const result = await AnswerService.sendMessage(
        mockProvider,
        mockMessage,
        mockConversationHistory,
        mockLang,
        null, // Context is null, backend/agent handles it
        mockEvaluation,
        mockReferringUrl,
        mockChatId
      );

      // 1. Verify prepareMessage call (context should be null)
      // Ensure all arguments match exactly, including chatId
      expect(prepareMessageSpy).toHaveBeenCalledWith(
          mockProvider, mockMessage, mockConversationHistory, mockLang, null, mockEvaluation, mockReferringUrl, mockChatId
      );

      // 2. Verify fetch call
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(mockApiUrl, expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String) // Body contains output of prepareMessage
      }));
      const fetchBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(fetchBody.message).toContain(mockMessage);
      expect(fetchBody.systemPrompt).toBe(mockSystemPrompt);


      // 3. Verify the structure of the returned result
      expect(result).toBeDefined();
      // Check parsed answer fields (using originalParseResponse)
      expect(result.content).toBe('Final answer text <s-1>Sentence 1.</s-1>');
      expect(result.answerType).toBe('normal'); // From parseResponse
      expect(result.citationUrl).toBe('http://agent.cite'); // From parseResponse
      expect(result.sentences).toEqual(["Sentence 1.", "", "", ""]); // From parseResponse
      // Check context object is present and correct (directly from API response)
      expect(result.context).toBeDefined();
      expect(result.context.topic).toBe('Derived Topic by Agent');
      expect(result.context.searchProvider).toBe('google');
      expect(result.context.tools).toEqual(expect.any(Array));
      // Check other metadata potentially merged (directly from API response)
      expect(result.model).toBe('agent-llm-model');
      expect(result.inputTokens).toBe(50);
      expect(result.outputTokens).toBe(25);
    });

     it('should handle fetch API errors', async () => {
        const apiError = new Error('API Failed');
        global.fetch.mockRejectedValue(apiError);

        await expect(AnswerService.sendMessage(
            mockProvider, mockMessage, mockConversationHistory, mockLang, null, mockEvaluation, mockReferringUrl, mockChatId
        )).rejects.toThrow('API Failed');

        // Match the exact arguments logged by the implementation's catch block
        expect(ClientLoggingService.error).toHaveBeenCalledWith(mockChatId, `Error calling ${mockProvider} API:`, apiError);
     });

     it('should handle non-ok fetch responses', async () => {
        const errorText = 'Internal Server Error';
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            text: () => Promise.resolve(errorText), // Ensure text() is mocked
        });

         await expect(AnswerService.sendMessage(
            mockProvider, mockMessage, mockConversationHistory, mockLang, null, mockEvaluation, mockReferringUrl, mockChatId
        )).rejects.toThrow('HTTP error! status: 500');

        // Assert the specific error logged before the throw
        expect(ClientLoggingService.error).toHaveBeenCalledWith(mockChatId, `${mockProvider} API error response:`, errorText);
        // Also assert the second log call from the catch block
        expect(ClientLoggingService.error).toHaveBeenCalledWith(mockChatId, `Error calling ${mockProvider} API:`, expect.any(Error));
     });

     // Add tests for different message types (evaluation), history handling, etc. if they affect prepareMessage or API call
  });

  // Keep existing tests for prepareMessage, parseResponse, sendBatchMessages if they are still relevant
  // and update them if their logic changes indirectly.

  describe('parseResponse', () => {
    // Add or keep tests for parseResponse to ensure it handles various formats
    it('should parse standard answer with sentences and citation', () => {
        const text = '<answer>This is the answer. <s-1>Sentence one.</s-1> <s-2>Sentence two.</s-2></answer><citation-url>http://cite.me</citation-url>';
        const parsed = AnswerService.parseResponse(text);
        expect(parsed.content).toBe('This is the answer. <s-1>Sentence one.</s-1> <s-2>Sentence two.</s-2>');
        expect(parsed.answerType).toBe('normal');
        expect(parsed.citationUrl).toBe('http://cite.me');
        expect(parsed.sentences).toEqual(["Sentence one.", "Sentence two.", "", ""]);
    });

    it('should parse clarifying question', () => {
        const text = '<clarifying-question>What do you mean?</clarifying-question>';
        const parsed = AnswerService.parseResponse(text);
        expect(parsed.content).toBe('What do you mean?');
        expect(parsed.answerType).toBe('clarifying-question');
    });
     // ... other parseResponse tests
  });

});
