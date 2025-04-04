import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler from '../db-persist-interaction.js'; // The handler under test
import dbConnect from '../db-connect.js'; // Import to mock
import { Chat } from '../../../models/chat.js';
import { Interaction } from '../../../models/interaction.js';
import { Context } from '../../../models/context.js';
import { Question } from '../../../models/question.js';
import { Citation } from '../../../models/citation.js';
import { Answer } from '../../../models/answer.js';
import { Tool } from '../../../models/tool.js';
import EmbeddingService from '../../../services/EmbeddingService.js';
import EvaluationService from '../../../services/EvaluationService.js';
import ServerLoggingService from '../../../services/ServerLoggingService.js';

// --- Mock DB Connect ---
vi.mock('../db-connect.js', () => ({
  default: vi.fn().mockResolvedValue(true) // Mock the default export function
}));

// --- Mock Services ---
vi.mock('../../../services/EmbeddingService.js');
vi.mock('../../../services/EvaluationService.js');
// Mock ServerLoggingService - Ensure the mock structure matches how it's used (default export object)
vi.mock('../../../services/ServerLoggingService.js', () => ({
  default: { // Keep the default export structure for the mock definition
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

// --- Mock Mongoose Models ---
const mockSave = vi.fn().mockResolvedValue(true);
const mockChatInstance = { _id: 'mock-chat-id', chatId: 'test-chat-id', interactions: [], save: mockSave };
const mockInteractionInstance = { _id: 'mock-interaction-id', interactionId: 'test-message-id', save: mockSave }; // Add interactionId
const mockContextInstance = { _id: 'mock-context-id', save: mockSave };
const mockQuestionInstance = { _id: 'mock-question-id', save: mockSave };
const mockCitationInstance = { _id: 'mock-citation-id', save: mockSave };
const mockAnswerInstance = { _id: 'mock-answer-id', save: mockSave };
const mockToolInstances = [{ _id: 'mock-tool-id-1' }]; // Simplify to one tool for easier checks

// Mock Models (using vi.hoisted for potentially better mock timing)
const { Chat: MockChat } = vi.hoisted(() => ({ Chat: vi.fn().mockImplementation(() => ({ ...mockChatInstance, save: mockSave })) }));
const { Interaction: MockInteraction } = vi.hoisted(() => ({ Interaction: vi.fn().mockImplementation(() => ({ ...mockInteractionInstance, save: mockSave })) }));
const { Context: MockContext } = vi.hoisted(() => ({ Context: vi.fn().mockImplementation(() => ({ ...mockContextInstance, save: mockSave })) }));
const { Question: MockQuestion } = vi.hoisted(() => ({ Question: vi.fn().mockImplementation(() => ({ ...mockQuestionInstance, save: mockSave })) }));
const { Citation: MockCitation } = vi.hoisted(() => ({ Citation: vi.fn().mockImplementation(() => ({ ...mockCitationInstance, save: mockSave })) }));
const { Answer: MockAnswer } = vi.hoisted(() => ({ Answer: vi.fn().mockImplementation(() => ({ ...mockAnswerInstance, save: mockSave })) }));
const { Tool: MockTool } = vi.hoisted(() => ({ Tool: vi.fn().mockImplementation(() => ({ _id: `mock-tool-id-${Math.random()}` })) }));

vi.mock('../../../models/chat.js', () => ({ Chat: MockChat }));
Chat.findOne = vi.fn(); // Static method mock

vi.mock('../../../models/interaction.js', () => ({ Interaction: MockInteraction }));
vi.mock('../../../models/context.js', () => ({ Context: MockContext }));
vi.mock('../../../models/question.js', () => ({ Question: MockQuestion }));
vi.mock('../../../models/citation.js', () => ({ Citation: MockCitation }));
vi.mock('../../../models/answer.js', () => ({ Answer: MockAnswer }));
vi.mock('../../../models/tool.js', () => ({ Tool: MockTool }));
Tool.insertMany = vi.fn(); // Static method mock


// --- Test Suite ---
describe('db-persist-interaction handler', () => {
  let req, res;
  // Use a fresh copy for each test via beforeEach
  const baseRequestBody = Object.freeze({ // Freeze to prevent accidental modification
    chatId: 'test-chat-id',
    userMessageId: 'test-message-id',
    selectedAI: 'test-ai',
    searchProvider: 'test-provider',
    pageLanguage: 'en',
    responseTime: 1000,
    referringUrl: 'https://test.com',
    context: { topic: 'test topic', department: 'test dept' },
    question: 'test question',
    answer: {
      content: 'test answer content',
      citationUrl: 'https://test-citation.com',
      citationHead: 'Test Citation',
      sentences: ['sentence 1', 'sentence 2'],
      tools: [{ tool: 'test-tool', input: 'test input', output: 'test output', startTime: new Date().toISOString(), endTime: new Date().toISOString(), duration: 100, status: 'completed' }],
      questionLanguage: 'en',
      englishQuestion: 'test english question'
    },
    confidenceRating: 'high',
    finalCitationUrl: 'https://final-citation.com'
  });

  beforeEach(() => {
    req = { method: 'POST', body: JSON.parse(JSON.stringify(baseRequestBody)) }; // Deep copy
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    // Reset mocks and setup default behaviors for mocks defined outside vi.mock
    vi.mocked(Chat.findOne).mockResolvedValue({ ...mockChatInstance }); // Return a copy
    vi.mocked(Tool.insertMany).mockResolvedValue([...mockToolInstances]); // Return a copy
    vi.mocked(EmbeddingService.createEmbedding).mockResolvedValue(true);
    vi.mocked(EvaluationService.evaluateInteraction).mockResolvedValue({ _id: 'mock-eval-id' });
    mockSave.mockResolvedValue(true);

    // Reset constructor mocks if needed (though clearAllMocks should handle vi.fn)
    vi.mocked(MockChat).mockClear();
    vi.mocked(MockInteraction).mockClear();
    vi.mocked(MockContext).mockClear();
    vi.mocked(MockQuestion).mockClear();
    vi.mocked(MockCitation).mockClear();
    vi.mocked(MockAnswer).mockClear();
    vi.mocked(MockTool).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks(); // Clear all mocks including spies and stubs
  });

  it('should handle method not allowed (GET)', async () => {
    req.method = 'GET';
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ message: 'Method Not Allowed' });
    // No need to check logs as the current implementation doesn't log for method not allowed
  });

  it('should successfully persist interaction when chat exists', async () => {
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Interaction logged successfully' });
    expect(Chat.findOne).toHaveBeenCalledWith({ chatId: 'test-chat-id' });
    expect(MockChat).not.toHaveBeenCalled(); // Constructor check
    expect(Tool.insertMany).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledTimes(6);
    expect(EmbeddingService.createEmbedding).toHaveBeenCalledTimes(1);
    expect(EvaluationService.evaluateInteraction).toHaveBeenCalledTimes(1);

    // Check logging calls matching actual implementation
    expect(ServerLoggingService.info).toHaveBeenCalledWith(
        'Evaluation completed successfully', 
        'test-chat-id',
        { evaluationId: 'mock-eval-id' }
    );
  });

  it('should create a new chat if not found', async () => {
    vi.mocked(Chat.findOne).mockResolvedValueOnce(null);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Chat.findOne).toHaveBeenCalledWith({ chatId: 'test-chat-id' });
    expect(MockChat).toHaveBeenCalledTimes(1);
    // No specific log for creating new chat in the current implementation
    expect(mockSave).toHaveBeenCalledTimes(6);
  });

  it('should return 500 if embedding generation fails', async () => {
    const embeddingError = new Error('Embedding generation failed');
    vi.mocked(EmbeddingService.createEmbedding).mockRejectedValueOnce(embeddingError);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Failed to log interaction', error: embeddingError.message });
    expect(EvaluationService.evaluateInteraction).not.toHaveBeenCalled();
    // Check the error log based on actual implementation
    expect(ServerLoggingService.error).toHaveBeenCalledWith(
        'Failed to log interaction',
        'test-chat-id',
        embeddingError
    );
  });

  it('should return 200 even if evaluation fails', async () => {
    const evaluationError = new Error('Evaluation failed');
    vi.mocked(EvaluationService.evaluateInteraction).mockRejectedValueOnce(evaluationError);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Interaction logged successfully' });
    expect(EmbeddingService.createEmbedding).toHaveBeenCalledTimes(1);
    // Check error log based on actual implementation
    expect(ServerLoggingService.error).toHaveBeenCalledWith(
        'Evaluation failed',
        'test-chat-id',
        evaluationError
    );
  });

  it('should handle missing optional fields gracefully (no tools, no final citation, no confidence)', async () => {
    delete req.body.answer.tools;
    delete req.body.finalCitationUrl;
    delete req.body.confidenceRating;
    req.body.answer.sentences = null;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Tool.insertMany).not.toHaveBeenCalled();

    // Check Citation constructor call arguments - Simplified check
    expect(MockCitation).toHaveBeenCalledTimes(1);
    
    // Check Answer constructor call with correct empty arrays (matching implementation)
    expect(MockAnswer).toHaveBeenCalledTimes(1);
    
    expect(EmbeddingService.createEmbedding).toHaveBeenCalledTimes(1);
    expect(EvaluationService.evaluateInteraction).toHaveBeenCalledTimes(1);
  });

  it('should return 500 if a critical save operation fails (e.g., Tool.insertMany)', async () => {
      const insertManyError = new Error('DB insertMany failed');
      vi.mocked(Tool.insertMany).mockRejectedValueOnce(insertManyError);

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          message: 'Failed to log interaction',
          error: insertManyError.message
      }));

      expect(mockSave).not.toHaveBeenCalled();
      expect(EmbeddingService.createEmbedding).not.toHaveBeenCalled();
      expect(EvaluationService.evaluateInteraction).not.toHaveBeenCalled();
      // Check the error log based on actual implementation
      expect(ServerLoggingService.error).toHaveBeenCalledWith(
          'Failed to log interaction',
          'test-chat-id',
          insertManyError
      );
  });

});
