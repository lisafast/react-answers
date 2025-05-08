import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import ChatProcessingService from '../ChatProcessingService.js';
import DataStoreService from '../DataStoreService.js';
import ServerLoggingService from '../ServerLoggingService.js';
import { getAgent } from '../../agents/agentFactory.js';
import { StatusEventEmitterHandler } from '../../agents/StatusEventEmitterHandler.js';
import { ToolTrackingHandler } from '../../agents/ToolTrackingHandler.js';
import { parseResponse } from '../../utils/responseParser.js';
import PromptBuilderService from '../OldPromptBuilderService.js';
import CitationVerificationService from '../CitationVerificationService.js';
import EmbeddingService from '../EmbeddingService.js';
import EvaluationService from '../EvaluationService.js';
import PromptOverride from '../../models/promptOverride.js';
import { Chat } from '../../models/chat.js';
import { Interaction } from '../../models/interaction.js';
import { Answer } from '../../models/answer.js'; // Assuming Answer model is needed for interaction structure
import { Question } from '../../models/question.js'; // Assuming Question model is needed

// --- Mock Dependencies ---
vi.mock('../DataStoreService.js');
vi.mock('../ServerLoggingService.js');
vi.mock('../../agents/agentFactory.js');
vi.mock('../../agents/StatusEventEmitterHandler.js');
vi.mock('../../agents/ToolTrackingHandler.js');
vi.mock('../../utils/responseParser.js');
vi.mock('../OldPromptBuilderService.js');
vi.mock('../CitationVerificationService.js');
vi.mock('../EmbeddingService.js');
vi.mock('../EvaluationService.js');

// --- Test Suite ---
describe('ChatProcessingService', () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    await mongoose.connection.db.dropDatabase();
    DataStoreService.findChatById.mockResolvedValue({ _id: 'chat123', interactions: [] });
    DataStoreService.persistInteraction.mockImplementation(async (data) => ({
      _id: new mongoose.Types.ObjectId(),
      ...data,
      question: { _id: new mongoose.Types.ObjectId(), redactedQuestion: data.question },
      answer: { _id: new mongoose.Types.ObjectId(), ...data.answer },
      context: { _id: new mongoose.Types.ObjectId(), ...data.context },
    }));
    DataStoreService.findInteractionById.mockImplementation(async (id) => ({ _id: id }));
    ServerLoggingService.info.mockImplementation(() => {});
    ServerLoggingService.error.mockImplementation(() => {});
    ServerLoggingService.warn.mockImplementation(() => {});
    ServerLoggingService.debug.mockImplementation(() => {});
    getAgent.mockResolvedValue({
      invoke: vi.fn().mockResolvedValue({
        messages: [{ role: 'assistant', content: '{"content": "Mock AI response", "answerType": "general"}' }],
        response_metadata: { model_name: 'mock-model' }
      }),
    });
    StatusEventEmitterHandler.mockImplementation(() => ({ _emitEvent: vi.fn() }));
    ToolTrackingHandler.mockImplementation(() => ({ getToolUsageSummary: vi.fn().mockReturnValue([]) }));
    parseResponse.mockImplementation((content) => { try { return JSON.parse(content); } catch { return { content: content || 'Fallback content', answerType: 'unknown' }; } });
    PromptBuilderService.buildPrompt.mockResolvedValue('Mock System Prompt');
    CitationVerificationService.verifyCitation.mockResolvedValue({ finalCitationUrl: 'http://verified.url', confidenceRating: 0.9 });
    EmbeddingService.createEmbedding.mockResolvedValue(undefined);
    EvaluationService.evaluateInteraction.mockResolvedValue(undefined);
    vi.spyOn(PromptOverride, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processMessage', () => {
    const defaultParams = {
      chatId: 'chat123',
      userMessage: 'Hello there',
      lang: 'en',
      selectedAI: 'openai',
      selectedSearch: 'google',
      referringUrl: 'http://example.com',
      user: { _id: 'user456' },
    };

    it('should process a message successfully (happy path)', async () => {
      const result = await ChatProcessingService.processMessage(defaultParams);
      expect(getAgent).toHaveBeenCalledWith(defaultParams.selectedAI, defaultParams.selectedSearch, defaultParams.chatId, {});
      expect(PromptBuilderService.buildPrompt).toHaveBeenCalledWith(defaultParams.lang, defaultParams.referringUrl, {});
      const agentInstance = await getAgent();
      expect(agentInstance.invoke).toHaveBeenCalled();
      expect(parseResponse).toHaveBeenCalled();
      expect(CitationVerificationService.verifyCitation).not.toHaveBeenCalled();
      expect(DataStoreService.persistInteraction).toHaveBeenCalled();
      const persistedData = DataStoreService.persistInteraction.mock.calls[0][0];
      expect(persistedData.chatId).toBe(defaultParams.chatId);
      expect(persistedData.question).toBe(defaultParams.userMessage);
      expect(persistedData.answer.content).toBe('Mock AI response');
      expect(persistedData.selectedAI).toBe(defaultParams.selectedAI);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(DataStoreService.findInteractionById).toHaveBeenCalled();
      expect(EmbeddingService.createEmbedding).toHaveBeenCalled();
      expect(EvaluationService.evaluateInteraction).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.answer).toBe('Mock AI response');
      expect(result.answerType).toBe('general');
      expect(result.interactionId).toBeDefined();
      expect(result.citationUrl).toBeNull();
      expect(result.confidenceRating).toBeUndefined();
      expect(ServerLoggingService.info).toHaveBeenCalledWith(expect.stringContaining('Starting'), expect.any(String), expect.any(Object));
      expect(ServerLoggingService.info).toHaveBeenCalledWith(expect.stringContaining('persisted'), expect.any(String), expect.any(Object));
      expect(ServerLoggingService.info).toHaveBeenCalledWith(expect.stringContaining('Finished'), expect.any(String), expect.any(Object));
      const statusEmitterInstance = StatusEventEmitterHandler.mock.results[0].value;
      expect(statusEmitterInstance._emitEvent).toHaveBeenCalledWith('processing_complete', expect.any(Object));
    });

    it('should apply prompt overrides when overrideUserId is provided', async () => {
      const overrideUserId = 'admin1';
      const mockOverrides = [{ filename: 'base/systemPrompt.js', content: 'Overridden System Prompt' }];
      vi.spyOn(PromptOverride, 'find').mockReset();
      vi.spyOn(PromptOverride, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockOverrides)
      });

      await ChatProcessingService.processMessage({ ...defaultParams, overrideUserId });

      const expectedOverridesMap = { 'base/systemPrompt.js': 'Overridden System Prompt' };
      expect(PromptOverride.find).toHaveBeenCalledWith({ userId: overrideUserId, isActive: true });
      expect(PromptBuilderService.buildPrompt).toHaveBeenCalledWith(defaultParams.lang, defaultParams.referringUrl, expectedOverridesMap);
      expect(getAgent).toHaveBeenCalledWith(defaultParams.selectedAI, defaultParams.selectedSearch, defaultParams.chatId, expectedOverridesMap);
      expect(ServerLoggingService.debug).toHaveBeenCalledWith(expect.stringContaining('Built system prompt using overrides'), expect.any(String), expect.any(Object));
    });

    it('should handle existing chat history', async () => {
      const interactionId = new mongoose.Types.ObjectId();
      const mockHistory = [
        { _id: interactionId, question: { redactedQuestion: 'Previous question' }, answer: { content: 'Previous answer' } }
      ];
      DataStoreService.findChatById.mockResolvedValueOnce({ _id: 'chat123', interactions: mockHistory });

      await ChatProcessingService.processMessage(defaultParams);

      const agentInstance = await getAgent();
      const invokedMessages = agentInstance.invoke.mock.calls[0][0].messages;
      expect(invokedMessages).toEqual(expect.arrayContaining([
        { role: 'user', content: 'Previous question' },
        { role: 'assistant', content: 'Previous answer' }
      ]));
      expect(ServerLoggingService.debug).toHaveBeenCalledWith(expect.stringContaining('Retrieved and converted chat history'), expect.any(String), expect.objectContaining({ dbCount: 1, agentCount: 2 }));
    });

    it('should trigger citation verification when citationUrl is present', async () => {
      const citationUrlFromAgent = 'http://needs.verification.com';
      getAgent.mockResolvedValueOnce({
        invoke: vi.fn().mockResolvedValue({
          messages: [{ role: 'assistant', content: JSON.stringify({ content: 'Response with citation', answerType: 'general', citationUrl: citationUrlFromAgent }) }],
          response_metadata: { model_name: 'mock-model' }
        }),
      });
      CitationVerificationService.verifyCitation.mockResolvedValueOnce({
        finalCitationUrl: 'http://verified.link',
        confidenceRating: 0.85
      });

      const result = await ChatProcessingService.processMessage(defaultParams);

      expect(CitationVerificationService.verifyCitation).toHaveBeenCalledWith(citationUrlFromAgent, defaultParams.lang, defaultParams.chatId);
      expect(result.citationUrl).toBe('http://verified.link');
      expect(result.confidenceRating).toBe(0.85);
      const persistedData = DataStoreService.persistInteraction.mock.calls[0][0];
      expect(persistedData.finalCitationUrl).toBe('http://verified.link');
      expect(persistedData.confidenceRating).toBe(0.85);
    });

    it('should handle agent invocation errors', async () => {
      const agentError = new Error('Agent failed');
      getAgent.mockResolvedValueOnce({ invoke: vi.fn().mockRejectedValue(agentError) });

      await expect(ChatProcessingService.processMessage(defaultParams)).rejects.toThrow('Agent failed');

      expect(ServerLoggingService.error).toHaveBeenCalledWith(expect.stringContaining('Error in ChatProcessingService.processMessage'), expect.any(String), expect.objectContaining({ error: 'Agent failed' }));
      const statusEmitterInstance = StatusEventEmitterHandler.mock.results[0].value;
      expect(statusEmitterInstance._emitEvent).toHaveBeenCalledWith('processing_error', { message: 'Agent failed' });
    });

    it('should handle persistence errors', async () => {
      const persistenceError = new Error('DB save failed');
      DataStoreService.persistInteraction.mockRejectedValueOnce(persistenceError);

      await expect(ChatProcessingService.processMessage(defaultParams)).rejects.toThrow('DB save failed');

      expect(ServerLoggingService.error).toHaveBeenCalledWith(expect.stringContaining('Error in ChatProcessingService.processMessage'), expect.any(String), expect.objectContaining({ error: 'DB save failed' }));
      const statusEmitterInstance = StatusEventEmitterHandler.mock.results[0].value;
      expect(statusEmitterInstance._emitEvent).toHaveBeenCalledWith('processing_error', { message: 'DB save failed' });
    });

    it('should handle chat not found gracefully', async () => {
      DataStoreService.findChatById.mockResolvedValueOnce(null);
      const result = await ChatProcessingService.processMessage(defaultParams);
      expect(result).toBeDefined();
      expect(result.answer).toBe('Mock AI response');
      const agentInstance = await getAgent();
      const messages = agentInstance.invoke.mock.calls[0][0].messages;
      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe(defaultParams.userMessage);
    });

    it('should handle background embedding errors gracefully', async () => {
      const embeddingError = new Error('Embedding service unavailable');
      EmbeddingService.createEmbedding.mockRejectedValueOnce(embeddingError);
      DataStoreService.findInteractionById.mockResolvedValue({ _id: 'interaction123' });

      const result = await ChatProcessingService.processMessage(defaultParams);
      expect(result).toBeDefined();
      expect(result.answer).toBe('Mock AI response');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(EmbeddingService.createEmbedding).toHaveBeenCalled();
      expect(ServerLoggingService.error).toHaveBeenCalledWith(
        'Background embedding creation failed',
        defaultParams.chatId,
        expect.objectContaining({ error: 'Embedding service unavailable' })
      );
      expect(EvaluationService.evaluateInteraction).toHaveBeenCalled();
    });

    it('should handle background evaluation errors gracefully', async () => {
      const evaluationError = new Error('Evaluation failed');
      EvaluationService.evaluateInteraction.mockRejectedValueOnce(evaluationError);
      DataStoreService.findInteractionById.mockResolvedValue({ _id: 'interaction123' });

      const result = await ChatProcessingService.processMessage(defaultParams);
      expect(result).toBeDefined();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(EvaluationService.evaluateInteraction).toHaveBeenCalled();
      expect(ServerLoggingService.error).toHaveBeenCalledWith(
        'Background evaluation failed',
        defaultParams.chatId,
        expect.objectContaining({ error: 'Evaluation failed' })
      );
      expect(EmbeddingService.createEmbedding).toHaveBeenCalled();
    });

    it('should handle prompt override fetching errors gracefully', async () => {
      const overrideFetchError = new Error('Cannot fetch overrides');
      vi.spyOn(PromptOverride, 'find').mockReturnValueOnce({
        lean: vi.fn().mockRejectedValue(overrideFetchError)
      });

      const result = await ChatProcessingService.processMessage({ ...defaultParams, overrideUserId: 'admin1' });
      expect(result).toBeDefined();

      expect(ServerLoggingService.error).toHaveBeenCalledWith('Error fetching prompt overrides', defaultParams.chatId, expect.objectContaining({ error: 'Cannot fetch overrides' }));
      expect(PromptBuilderService.buildPrompt).toHaveBeenCalledWith(defaultParams.lang, defaultParams.referringUrl, {});
      expect(getAgent).toHaveBeenCalledWith(defaultParams.selectedAI, defaultParams.selectedSearch, defaultParams.chatId, {});
    });

    it('should track and persist tool usage', async () => {
      const mockToolUsage = [{ toolName: 'googleContextSearch', callCount: 1, errorCount: 0 }];
      ToolTrackingHandler.mockImplementationOnce(() => ({
        getToolUsageSummary: vi.fn().mockReturnValue(mockToolUsage),
      }));

      await ChatProcessingService.processMessage(defaultParams);

      expect(DataStoreService.persistInteraction).toHaveBeenCalled();
      const persistedData = DataStoreService.persistInteraction.mock.calls[0][0];
      expect(persistedData.answer.tools).toEqual(mockToolUsage);
    });
  });
});
