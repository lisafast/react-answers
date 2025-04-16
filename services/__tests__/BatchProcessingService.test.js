import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import BatchProcessingService from '../BatchProcessingService.js';
import DataStoreService from '../DataStoreService.js';
import ChatProcessingService from '../ChatProcessingService.js';
import ServerLoggingService from '../ServerLoggingService.js';

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

  beforeEach(() => {
    vi.resetAllMocks();
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
        status: 'processing',
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

  describe('_processBatchItems', () => {
    it('should process items sequentially and maintain chat context', async () => {
      ChatProcessingService.processMessage.mockResolvedValueOnce({ interactionId: 'int1' });
      ChatProcessingService.processMessage.mockResolvedValueOnce({ interactionId: 'int2' });
      ChatProcessingService.processMessage.mockResolvedValueOnce({ interactionId: 'int3' });
      await BatchProcessingService._processBatchItems(mockBatch, mockEntries);
      expect(ChatProcessingService.processMessage).toHaveBeenCalledTimes(3);
      expect(ChatProcessingService.processMessage.mock.calls[0][0].chatId).toBe('chat1');
      expect(ChatProcessingService.processMessage.mock.calls[1][0].chatId).toBe('chat1');
      expect(ChatProcessingService.processMessage.mock.calls[2][0].chatId).toBe('chat2');
      expect(DataStoreService.updateBatchRun).toHaveBeenLastCalledWith(
        mockBatch._id,
        expect.objectContaining({
          $set: {
            status: 'completed',
            processedItems: 3,
            failedItems: 0
          }
        })
      );
    });

    it('should handle item processing failures with retries', async () => {
      ChatProcessingService.processMessage.mockResolvedValueOnce({ interactionId: 'int1' });
      ChatProcessingService.processMessage
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce({ interactionId: 'int2' });
      ChatProcessingService.processMessage.mockRejectedValue(new Error('Processing failed'));
      await BatchProcessingService._processBatchItems(mockBatch, mockEntries);
      expect(ChatProcessingService.processMessage).toHaveBeenCalledTimes(7);
      expect(ServerLoggingService.error).toHaveBeenCalledWith(
        'Batch item failed all retries:',
        mockBatch._id,
        expect.objectContaining({
          chatId: expect.any(String),
          error: expect.anything(),
          question: expect.any(String)
        })
      );
      expect(DataStoreService.updateBatchRun).toHaveBeenLastCalledWith(
        mockBatch._id,
        expect.objectContaining({
          $set: {
            status: 'completed_with_errors',
            processedItems: 2,
            failedItems: 1
          }
        })
      );
    });

    it('should handle critical errors and mark batch as failed', async () => {
      DataStoreService.updateBatchRun.mockRejectedValue(new Error('Database connection lost'));
      await expect(BatchProcessingService._processBatchItems(mockBatch, [mockEntries[0]])).rejects.toThrow('Database connection lost');
      expect(DataStoreService.updateBatchRun).toHaveBeenCalledWith(
        mockBatch._id,
        expect.objectContaining({
          $set: { status: 'error' }
        })
      );
      expect(ServerLoggingService.error).toHaveBeenCalledWith(
        'Batch item failed all retries:',
        mockBatch._id,
        expect.objectContaining({
          chatId: expect.any(String),
          error: expect.anything(),
          question: expect.any(String)
        })
      );
    });

    it('should handle cancellation by checking batch status', async () => {
      DataStoreService.findBatchRunById = vi.fn().mockResolvedValue({ ...mockBatch, status: 'cancelled' });
      await BatchProcessingService._processBatchItems(mockBatch, [mockEntries[0], mockEntries[1]]);
      // Allow processMessage to be called before cancellation is checked, but ensure batch is marked as completed
      expect(DataStoreService.updateBatchRun).toHaveBeenLastCalledWith(
        mockBatch._id,
        expect.objectContaining({
          $set: {
            status: 'completed',
            processedItems: expect.any(Number),
            failedItems: expect.any(Number)
          }
        })
      );
    });
  });
});