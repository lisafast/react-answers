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
  const mockFile = {
    text: vi.fn().mockResolvedValue('REDACTEDQUESTION,URL,chatId\n"Question 1",url1,chat1\n"Question 2",url2,chat1\n"Question 3",url3,chat2')
  };
  
  const mockBatchParams = {
    name: 'Test Batch',
    type: 'question',
    aiProvider: 'openai',
    searchProvider: 'google',
    pageLanguage: 'en',
    applyOverrides: false,
    uploaderUserId: 'user123',
    file: mockFile
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
    // Reset all mocks before each test
    vi.resetAllMocks();
    
    // Setup default mock implementations
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
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should throw error if CSV has no records', async () => {
      const emptyFile = {
        text: vi.fn().mockResolvedValue('REDACTEDQUESTION,URL,chatId\n')
      };

      await expect(BatchProcessingService.createBatch({
        ...mockBatchParams,
        file: emptyFile
      })).rejects.toThrow('CSV file contains no valid records');
    });

    it('should throw error if required columns are missing', async () => {
      const invalidFile = {
        text: vi.fn().mockResolvedValue('URL,chatId\n"url1",chat1')
      };

      await expect(BatchProcessingService.createBatch({
        ...mockBatchParams,
        file: invalidFile
      })).rejects.toThrow('CSV missing required columns: REDACTEDQUESTION');
    });
  });

  describe('_processBatchItems', () => {
    it('should process items sequentially and maintain chat context', async () => {
      // Mock successful processing
      ChatProcessingService.processMessage.mockResolvedValueOnce({ interactionId: 'int1' });
      ChatProcessingService.processMessage.mockResolvedValueOnce({ interactionId: 'int2' });
      ChatProcessingService.processMessage.mockResolvedValueOnce({ interactionId: 'int3' });

      const records = [
        { REDACTEDQUESTION: 'Q1', URL: 'url1', chatId: 'chat1' },
        { REDACTEDQUESTION: 'Q2', URL: 'url2', chatId: 'chat1' },
        { REDACTEDQUESTION: 'Q3', URL: 'url3', chatId: 'chat2' }
      ];

      await BatchProcessingService._processBatchItems(mockBatch, records);

      // Verify chat grouping by checking the order of calls
      expect(ChatProcessingService.processMessage).toHaveBeenCalledTimes(3);
      expect(ChatProcessingService.processMessage.mock.calls[0][0].chatId).toBe('chat1');
      expect(ChatProcessingService.processMessage.mock.calls[1][0].chatId).toBe('chat1');
      expect(ChatProcessingService.processMessage.mock.calls[2][0].chatId).toBe('chat2');

      // Verify final status update
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
      // First item succeeds
      ChatProcessingService.processMessage.mockResolvedValueOnce({ interactionId: 'int1' });
      
      // Second item fails twice then succeeds
      ChatProcessingService.processMessage
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce({ interactionId: 'int2' });
      
      // Third item fails all retries
      ChatProcessingService.processMessage
        .mockRejectedValue(new Error('Processing failed'));

      const records = [
        { REDACTEDQUESTION: 'Q1', URL: 'url1', chatId: 'chat1' },
        { REDACTEDQUESTION: 'Q2', URL: 'url2', chatId: 'chat1' },
        { REDACTEDQUESTION: 'Q3', URL: 'url3', chatId: 'chat2' }
      ];

      await BatchProcessingService._processBatchItems(mockBatch, records);

      // Verify retry attempts (1 + 3 + 3 = 7 total calls)
      expect(ChatProcessingService.processMessage).toHaveBeenCalledTimes(7);

      // Verify error logging
      expect(ServerLoggingService.error).toHaveBeenCalledWith(
        'Batch item failed all retries:',
        mockBatch._id,
        expect.any(Object)
      );

      // Verify final status update
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
      // Simulate a critical error (e.g., DB connection lost)
      DataStoreService.updateBatchRun.mockRejectedValue(new Error('Database connection lost'));

      const records = [
        { REDACTEDQUESTION: 'Q1', URL: 'url1', chatId: 'chat1' }
      ];

      await expect(BatchProcessingService._processBatchItems(mockBatch, records))
        .rejects.toThrow('Database connection lost');

      // Verify batch marked as error
      expect(DataStoreService.updateBatchRun).toHaveBeenCalledWith(
        mockBatch._id,
        expect.objectContaining({
          $set: { status: 'error' }
        })
      );

      expect(ServerLoggingService.error).toHaveBeenCalledWith(
        'Batch processing failed:',
        mockBatch._id,
        expect.any(Error)
      );
    });

    it('should handle cancellation by checking batch status', async () => {
      // Mock batch status check to simulate cancellation
      DataStoreService.findBatchRunById = vi.fn().mockResolvedValue({ 
        ...mockBatch, 
        status: 'cancelled' 
      });

      const records = [
        { REDACTEDQUESTION: 'Q1', URL: 'url1', chatId: 'chat1' },
        { REDACTEDQUESTION: 'Q2', URL: 'url2', chatId: 'chat1' }
      ];

      await BatchProcessingService._processBatchItems(mockBatch, records);

      // Verify no further processing attempted after cancellation
      expect(ChatProcessingService.processMessage).not.toHaveBeenCalled();
      
      // Verify final status remains cancelled
      expect(DataStoreService.updateBatchRun).toHaveBeenLastCalledWith(
        mockBatch._id,
        expect.objectContaining({
          $set: { status: 'cancelled' }
        })
      );
    });
  });
});