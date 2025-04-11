import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import handler from '../db-persist-interaction.js';
import { Chat } from '../../../models/chat.js';
import { Interaction } from '../../../models/interaction.js';
import { Context } from '../../../models/context.js';
import { Question } from '../../../models/question.js';
import { Citation } from '../../../models/citation.js';
import { Answer } from '../../../models/answer.js';
import { Tool } from '../../../models/tool.js';
import { embedText, embedDocuments } from '../../../services/EmbeddingService.js';

// Mock the dependencies
jest.mock('../../../services/EmbeddingService.js');
jest.mock('../../../services/ServerLoggingService.js');

describe('db-persist-interaction handler', () => {
  let req, res;

  beforeAll(async () => {
    await mongoose.connect(global.__MONGO_URI__);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(() => {
    req = {
      method: 'POST',
      body: {
        chatId: 'test-chat-id',
        userMessageId: 'test-message-id',
        selectedAI: 'test-ai',
        searchProvider: 'test-provider',
        pageLanguage: 'en',
        responseTime: 1000,
        referringUrl: 'https://test.com',
        context: {
          topic: 'test topic',
          department: 'test dept'
        },
        question: 'test question',
        answer: {
          content: 'test answer content',
          citationUrl: 'https://test-citation.com',
          citationHead: 'Test Citation',
          sentences: ['sentence 1', 'sentence 2'],
          tools: [{
            tool: 'test-tool',
            input: 'test input',
            output: 'test output',
            startTime: new Date(),
            endTime: new Date(),
            duration: 100,
            status: 'completed'
          }]
        },
        confidenceRating: 'high',
        finalCitationUrl: 'https://final-citation.com'
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Mock the embedding functions
    embedText.mockResolvedValue([0.1, 0.2, 0.3]);
    embedDocuments.mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]);
  });

  afterEach(async () => {
    await Chat.deleteMany({});
    await Interaction.deleteMany({});
    await Context.deleteMany({});
    await Question.deleteMany({});
    await Citation.deleteMany({});
    await Answer.deleteMany({});
    await Tool.deleteMany({});
    jest.clearAllMocks();
  });

  it('should handle method not allowed', async () => {
    req.method = 'GET';
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ message: 'Method Not Allowed' });
  });

  it('should successfully persist interaction with embeddings', async () => {
    await handler(req, res);

    // Verify response
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Interaction logged successfully' });

    // Verify chat was created
    const chat = await Chat.findOne({ chatId: req.body.chatId });
    expect(chat).toBeTruthy();
    expect(chat.aiProvider).toBe(req.body.selectedAI);
    expect(chat.searchProvider).toBe(req.body.searchProvider);
    expect(chat.pageLanguage).toBe(req.body.pageLanguage);

    // Verify interaction and related documents were created
    const interaction = await Interaction.findOne({ interactionId: req.body.userMessageId })
      .populate('context')
      .populate('question')
      .populate({
        path: 'answer',
        populate: ['citation', 'tools']
      });

    expect(interaction).toBeTruthy();
    expect(interaction.responseTime).toBe(req.body.responseTime);
    expect(interaction.referringUrl).toBe(req.body.referringUrl);

    // Verify context
    expect(interaction.context).toBeTruthy();
    expect(interaction.context.topic).toBe(req.body.context.topic);
    expect(interaction.context.department).toBe(req.body.context.department);

    // Verify question with embedding
    expect(interaction.question).toBeTruthy();
    expect(interaction.question.redactedQuestion).toBe(req.body.question);
    expect(interaction.question.embedding).toEqual([0.1, 0.2, 0.3]);

    // Verify citation
    expect(interaction.answer.citation).toBeTruthy();
    expect(interaction.answer.citation.aiCitationUrl).toBe(req.body.answer.citationUrl);
    expect(interaction.answer.citation.providedCitationUrl).toBe(req.body.finalCitationUrl);
    expect(interaction.answer.citation.confidenceRating).toBe(req.body.confidenceRating);
    expect(interaction.answer.citation.citationHead).toBe(req.body.answer.citationHead);

    // Verify answer with embeddings
    expect(interaction.answer).toBeTruthy();
    expect(interaction.answer.content).toBe(req.body.answer.content);
    expect(interaction.answer.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(interaction.answer.sentenceEmbeddings).toEqual([[0.1, 0.2], [0.3, 0.4]]);

    // Verify tools
    expect(interaction.answer.tools).toHaveLength(1);
    const tool = interaction.answer.tools[0];
    expect(tool.tool).toBe(req.body.answer.tools[0].tool);
    expect(tool.input).toBe(req.body.answer.tools[0].input);
    expect(tool.output).toBe(req.body.answer.tools[0].output);
    expect(tool.status).toBe(req.body.answer.tools[0].status);
  });

  it('should handle embedding generation errors gracefully', async () => {
    // Mock embedding failures
    embedText.mockRejectedValue(new Error('Embedding generation failed'));
    embedDocuments.mockRejectedValue(new Error('Sentence embedding generation failed'));

    await handler(req, res);

    // Should still succeed overall
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Interaction logged successfully' });

    // Verify documents were created without embeddings
    const interaction = await Interaction.findOne({ interactionId: req.body.userMessageId })
      .populate({
        path: 'answer',
        populate: ['citation', 'tools']
      })
      .populate('question');

    expect(interaction.question.embedding).toBeUndefined();
    expect(interaction.answer.embedding).toBeUndefined();
    expect(interaction.answer.sentenceEmbeddings).toBeUndefined();
  });

  it('should handle missing optional fields', async () => {
    // Remove optional fields
    delete req.body.answer.tools;
    delete req.body.answer.sentences;
    delete req.body.confidenceRating;
    delete req.body.finalCitationUrl;

    await handler(req, res);

    // Should succeed
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Interaction logged successfully' });

    // Verify documents were created without optional fields
    const interaction = await Interaction.findOne({ interactionId: req.body.userMessageId })
      .populate({
        path: 'answer',
        populate: ['citation', 'tools']
      });

    expect(interaction.answer.tools).toHaveLength(0);
    expect(interaction.answer.sentences).toBeUndefined();
    expect(interaction.answer.citation.confidenceRating).toBeUndefined();
    expect(interaction.answer.citation.providedCitationUrl).toBeUndefined();
  });
});