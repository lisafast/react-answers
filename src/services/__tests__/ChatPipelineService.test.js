import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatPipelineService, PipelineStatus } from '../ChatPipelineService.js';
import ContextService from '../ContextService.js';
import AnswerService from '../AnswerService.js';
import DataStoreService from '../DataStoreService.js';
import RedactionService from '../RedactionService.js';
import LoggingService from '../ClientLoggingService.js';
import { urlToSearch } from '../../utils/urlToSearch.js';

// Mock dependencies
vi.mock('../ContextService.js');
vi.mock('../AnswerService.js');
vi.mock('../DataStoreService.js');
vi.mock('../RedactionService.js');
vi.mock('../ClientLoggingService.js');
vi.mock('../../utils/urlToSearch.js');

describe('ChatPipelineService', () => {
  const mockChatId = 'test-chat-id';
  const mockUserMessage = 'Hello, tell me about testing.';
  const mockUserMessageId = 'msg-1';
  const mockLang = 'en';
  const mockDepartment = 'dev';
  const mockReferringUrl = 'http://example.com';
  const mockSelectedAI = 'openai';
  const mockSearchProvider = 'google';
  const mockTranslationF = vi.fn((key) => key); // Simple mock translator
  const mockOnStatusUpdate = vi.fn();

  // Mock data structures
  const mockContextFromAgent = {
    topic: 'Testing',
    topicUrl: 'http://testing.url',
    department: 'dev',
    departmentUrl: null,
    searchResults: 'mock search results from agent tool',
    searchProvider: mockSearchProvider,
    model: 'context-model',
    inputTokens: 5,
    outputTokens: 15,
    tools: [{ tool: 'getContext', input: '...', output: '...' }], // Simulate tool usage
  };

  const mockAnswerFromAgent = {
    content: 'This is the final answer about testing.',
    answerType: 'normal',
    citationUrl: 'http://citation.url/original',
    citationHead: 'Citation Title',
    questionLanguage: mockLang,
    englishQuestion: mockUserMessage,
    // IMPORTANT: Simulate AnswerService returning context metadata from the agent
    context: mockContextFromAgent,
    // Other potential fields from AnswerService response
    inputTokens: 100,
    outputTokens: 50,
    model: 'answer-model',
    tools: [], // Tools used by the answering agent itself
  };

  const mockCitationResult = {
    url: 'http://citation.url/verified',
    confidenceRating: 0.9,
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup default mock implementations
    RedactionService.ensureInitialized = vi.fn().mockResolvedValue();
    RedactionService.redactText = vi.fn((text) => ({ redactedText: text, redactedItems: [] }));
    LoggingService.info = vi.fn();
    LoggingService.error = vi.fn();
    urlToSearch.validateAndCheckUrl = vi.fn().mockResolvedValue(mockCitationResult);
    DataStoreService.persistInteraction = vi.fn(); // Mock the persistence call

    // --- KEY MOCKS FOR TDD ---
    // 1. ContextService.deriveContext should NOT be called in the new flow
    ContextService.deriveContext = vi.fn().mockRejectedValue(new Error('ContextService.deriveContext should NOT be called directly!'));

    // 2. AnswerService.sendMessage should return the answer AND the context object
    AnswerService.sendMessage = vi.fn().mockResolvedValue(mockAnswerFromAgent);
    // --- END KEY MOCKS ---
  });

  it('should run the pipeline, call AnswerService, and persist interaction with context from AnswerService', async () => {
    const conversationHistory = []; // Start with empty history

    const result = await ChatPipelineService.processResponse(
      mockChatId,
      mockUserMessage,
      mockUserMessageId,
      conversationHistory,
      mockLang,
      mockDepartment,
      mockReferringUrl,
      mockSelectedAI,
      mockTranslationF,
      mockOnStatusUpdate,
      mockSearchProvider
    );

    // Verify status updates
    expect(mockOnStatusUpdate).toHaveBeenCalledWith(PipelineStatus.MODERATING_QUESTION);
    expect(mockOnStatusUpdate).toHaveBeenCalledWith(PipelineStatus.REDACTING);
    // GETTING_CONTEXT should NOT be called directly anymore
    expect(mockOnStatusUpdate).not.toHaveBeenCalledWith(PipelineStatus.GETTING_CONTEXT);
    expect(mockOnStatusUpdate).toHaveBeenCalledWith(PipelineStatus.GENERATING_ANSWER);
    expect(mockOnStatusUpdate).toHaveBeenCalledWith(PipelineStatus.VERIFYING_CITATION);
    expect(mockOnStatusUpdate).toHaveBeenCalledWith(PipelineStatus.UPDATING_DATASTORE);
    expect(mockOnStatusUpdate).toHaveBeenCalledWith(PipelineStatus.COMPLETE);

    // Verify redaction was called
    expect(RedactionService.redactText).toHaveBeenCalledWith(mockUserMessage);

    // Verify ContextService.deriveContext was NOT called
    expect(ContextService.deriveContext).not.toHaveBeenCalled();

    // Verify AnswerService.sendMessage was called correctly (without context initially)
    expect(AnswerService.sendMessage).toHaveBeenCalledWith(
      mockSelectedAI,
      mockUserMessage,
      conversationHistory, // Empty in this case
      mockLang,
      null, // Context is initially null, agent should fetch it
      false, // eval flag
      mockReferringUrl,
      mockChatId
    );

    // Verify citation check was called
    expect(urlToSearch.validateAndCheckUrl).toHaveBeenCalledWith(
      mockAnswerFromAgent.citationUrl,
      mockLang,
      mockUserMessage, // Assuming original message is used for validation context
      mockDepartment,
      mockTranslationF
    );

    // Verify DataStoreService.persistInteraction was called with the context from AnswerService
    expect(DataStoreService.persistInteraction).toHaveBeenCalledTimes(1);
    const persistedData = DataStoreService.persistInteraction.mock.calls[0][0];
    expect(persistedData.selectedAI).toBe(mockSelectedAI);
    expect(persistedData.question).toBe(mockUserMessage);
    expect(persistedData.answer).toEqual(mockAnswerFromAgent); // Pass the whole answer object
    expect(persistedData.finalCitationUrl).toBe(mockCitationResult.url);
    expect(persistedData.confidenceRating).toBe(mockCitationResult.confidenceRating);
    // CRITICAL: Check context comes from the mocked AnswerService response
    expect(persistedData.context).toEqual(mockContextFromAgent);
    expect(persistedData.chatId).toBe(mockChatId);
    expect(persistedData.searchProvider).toBe(mockSearchProvider); // Ensure searchProvider is passed

    // Verify the final returned result
    expect(result).toEqual({
      answer: mockAnswerFromAgent,
      context: mockContextFromAgent, // Context from AnswerService
      question: mockUserMessage,
      citationUrl: mockCitationResult.url,
      confidenceRating: mockCitationResult.confidenceRating,
    });
  });

  it('should skip direct context derivation even if history is present but last answer was a question', async () => {
    const conversationHistory = [
      {
        sender: 'ai',
        error: false,
        interaction: {
          answer: { answerType: 'question', content: 'Clarification needed?' },
          context: { topic: 'Old Topic' } // Previous context exists
        }
      }
    ];

    await ChatPipelineService.processResponse(
      mockChatId, mockUserMessage, mockUserMessageId, conversationHistory, mockLang, mockDepartment, mockReferringUrl, mockSelectedAI, mockTranslationF, mockOnStatusUpdate, mockSearchProvider
    );

    // Verify ContextService.deriveContext was NOT called
    expect(ContextService.deriveContext).not.toHaveBeenCalled();

    // Verify AnswerService.sendMessage was called (context initially null)
    expect(AnswerService.sendMessage).toHaveBeenCalledWith(
      mockSelectedAI, mockUserMessage, expect.any(Array), mockLang, null, false, mockReferringUrl, mockChatId
    );

    // Verify persistence uses context from AnswerService
    expect(DataStoreService.persistInteraction).toHaveBeenCalledTimes(1);
    const persistedData = DataStoreService.persistInteraction.mock.calls[0][0];
    expect(persistedData.context).toEqual(mockContextFromAgent);
  });

   it('should handle answerType "question" correctly (no citation check)', async () => {
    const questionAnswer = { ...mockAnswerFromAgent, answerType: 'question', citationUrl: null };
    AnswerService.sendMessage.mockResolvedValue(questionAnswer); // Override mock

    const result = await ChatPipelineService.processResponse(
      mockChatId, mockUserMessage, mockUserMessageId, [], mockLang, mockDepartment, mockReferringUrl, mockSelectedAI, mockTranslationF, mockOnStatusUpdate, mockSearchProvider
    );

    expect(mockOnStatusUpdate).toHaveBeenCalledWith(PipelineStatus.NEED_CLARIFICATION);
    expect(urlToSearch.validateAndCheckUrl).not.toHaveBeenCalled(); // No citation check
    expect(DataStoreService.persistInteraction).toHaveBeenCalledTimes(1);
    const persistedData = DataStoreService.persistInteraction.mock.calls[0][0];
    expect(persistedData.answer).toEqual(questionAnswer);
    expect(persistedData.finalCitationUrl).toBeUndefined(); // Or null, depending on how it's handled
    expect(persistedData.confidenceRating).toBeNull();
    expect(persistedData.context).toEqual(mockContextFromAgent); // Still expect context

    expect(result.citationUrl).toBeUndefined(); // Or null
    expect(result.confidenceRating).toBeNull();
  });

  // Add more tests for error handling, different conversation history scenarios etc.
});
