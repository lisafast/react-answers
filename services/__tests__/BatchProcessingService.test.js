import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import BatchProcessingService from '../BatchProcessingService.js';
import DataStoreService from '../DataStoreService.js';
import ChatProcessingService from '../ChatProcessingService.js';
import ServerLoggingService from '../ServerLoggingService.js';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Chat } from '../../models/chat.js';

// Mock dependencies
vi.mock('../DataStoreService.js');
vi.mock('../ChatProcessingService.js');
vi.mock('../ServerLoggingService.js');

describe('BatchProcessingService', () => {
  const mockEntries = [
    { REDACTEDQUESTION: 'Q1', URL: 'url1', chatId: 'chat1' },
    { REDACTEDQUESTION: 'Q2', URL: 'url2', chatId: 'chat1' },
    { REDACTEDQUESTION: 'Q3', URL: 'url3', chatId: 'chat2' }
  ];

  const mockBatchParams = {
    name: 'Test Batch',
    type: 'question',
    aiProvider: 'openai',
    searchProvider: 'google',
    pageLanguage: 'en',
    applyOverrides: false,
    uploaderUserId: 'user123',
    entries: mockEntries
  };

  const mockBatch = {
    _id: 'batch123',
    ...mockBatchParams,
    status: 'processing',
    totalItems: 3,
    processedItems: 0,
    failedItems: 0,
    interactions: []
  };

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
    DataStoreService.createBatchRun.mockResolvedValue(mockBatch);
    DataStoreService.updateBatchRun.mockResolvedValue({ acknowledged: true });
    ChatProcessingService.processMessage.mockResolvedValue({ interactionId: 'int123' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createBatch', () => {
    it('should create a new batch and start processing', async () => {
      const result = await BatchProcessingService.createBatch(mockBatchParams);
      expect(DataStoreService.createBatchRun).toHaveBeenCalledWith(expect.objectContaining({
        name: mockBatchParams.name,
        type: mockBatchParams.type,
        aiProvider: mockBatchParams.aiProvider,
        searchProvider: mockBatchParams.searchProvider,
        pageLanguage: mockBatchParams.pageLanguage,
        applyOverrides: mockBatchParams.applyOverrides,
        uploaderUserId: mockBatchParams.uploaderUserId,
        status: 'queued',
        totalItems: 3,
        processedItems: 0,
        failedItems: 0
      }));
      expect(result).toEqual(mockBatch);
      expect(ServerLoggingService.info).toHaveBeenCalledWith(
        'Creating new batch',
        { name: mockBatchParams.name, type: mockBatchParams.type }
      );
    });

    it('should throw error if entries has no records', async () => {
      await expect(BatchProcessingService.createBatch({
        ...mockBatchParams,
        entries: []
      })).rejects.toThrow('No valid records provided');
    });

    it('should throw error if required columns are missing', async () => {
      await expect(BatchProcessingService.createBatch({
        ...mockBatchParams,
        entries: [{ URL: 'url1', chatId: 'chat1' }]
      })).rejects.toThrow('Entries missing required columns: REDACTEDQUESTION');
    });
  });

  // All tests for _processBatchItems have been removed as that method no longer exists.

  describe('processBatchForDuration (in-memory MongoDB)', () => {
    let batchId;
    let chatDocs = [];
    let batchDoc;

    beforeEach(async () => {
      // Create chats for the batch
      chatDocs = await Chat.create([
        { chatId: 'chat1', aiProvider: 'openai', searchProvider: 'google', pageLanguage: 'en', interactions: [] },
        { chatId: 'chat2', aiProvider: 'openai', searchProvider: 'google', pageLanguage: 'en', interactions: [] },
        { chatId: 'chat3', aiProvider: 'openai', searchProvider: 'google', pageLanguage: 'en', interactions: [] }
      ]);
      // Create a batch doc object that can be mutated by mocks
      batchDoc = {
        _id: 'batchid1',
        name: 'Batch',
        type: 'question',
        aiProvider: 'openai',
        searchProvider: 'google',
        pageLanguage: 'en',
        applyOverrides: false,
        uploaderUserId: 'user123',
        status: 'processing',
        totalItems: 3,
        processedItems: 0,
        failedItems: 0,
        chats: chatDocs.map(c => c._id),
        entries: [
          { REDACTEDQUESTION: 'Q1', chatId: 'chat1' },
          { REDACTEDQUESTION: 'Q2', chatId: 'chat2' },
          { REDACTEDQUESTION: 'Q3', chatId: 'chat3' }
        ],
        lastProcessedIndex: 0
      };

      // findBatchRunById returns the current state of batchDoc
      DataStoreService.findBatchRunById.mockImplementation(async (id) => {
        if (id === batchDoc._id) {
          return JSON.parse(JSON.stringify(batchDoc)); // Return a copy to prevent direct mutation issues
        }
        return null;
      });

      // updateBatchRun mock that modifies the batchDoc object
      DataStoreService.updateBatchRun.mockImplementation(async (id, update) => {
        if (id === batchDoc._id) {
          if (update.$set) {
            Object.assign(batchDoc, update.$set);
          }
          if (update.$inc) {
            for (const key in update.$inc) {
              batchDoc[key] = (batchDoc[key] || 0) + update.$inc[key];
            }
          }
          return { acknowledged: true };
        }
        return { acknowledged: false };
      });

      ChatProcessingService.processMessage.mockResolvedValue({ interactionId: 'intX' });
    });

    it('processes all items within duration and marks batch as completed', async () => {
      // Simulate enough time for all items
      const result = await BatchProcessingService.processBatchForDuration(batchDoc._id, 10);
      expect(ChatProcessingService.processMessage).toHaveBeenCalledTimes(3);
      expect(DataStoreService.updateBatchRun).toHaveBeenCalledWith(batchDoc._id, expect.objectContaining({ $set: expect.objectContaining({ status: 'completed' }) }));
      expect(result.status).toBe('completed');
      expect(result.processedCount + result.failedCount).toBe(3);
      expect(result.isComplete).toBe(true);
    });

    it('resumes from lastProcessedIndex', async () => {
      batchDoc.lastProcessedIndex = 1;
      DataStoreService.findBatchRunById.mockResolvedValueOnce(batchDoc);
      const result = await BatchProcessingService.processBatchForDuration(batchDoc._id, 10, 1);
      expect(ChatProcessingService.processMessage).toHaveBeenCalledTimes(2);
      expect(result.processedCount + result.failedCount).toBeGreaterThanOrEqual(2);
    });

    it('handles missing Chat documents as failed', async () => {
      // Remove one chat from DB
      await Chat.deleteOne({ _id: chatDocs[1]._id });
      const result = await BatchProcessingService.processBatchForDuration(batchDoc._id, 10);
      expect(ChatProcessingService.processMessage).toHaveBeenCalledTimes(2);
      expect(result.failedCount).toBeGreaterThanOrEqual(1);
    });

    it('retries failed ChatProcessingService.processMessage up to MAX_RETRIES', async () => {
      ChatProcessingService.processMessage
        .mockRejectedValueOnce(new Error('fail1'))
        .mockRejectedValueOnce(new Error('fail2'))
        .mockResolvedValueOnce({ interactionId: 'intX' });
      const result = await BatchProcessingService.processBatchForDuration(batchDoc._id, 10);
      expect(ChatProcessingService.processMessage).toHaveBeenCalled();
      // Should have retried at least 3 times for the first item
      expect(ChatProcessingService.processMessage.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(result.processedCount + result.failedCount).toBe(3);
    });
  });
});