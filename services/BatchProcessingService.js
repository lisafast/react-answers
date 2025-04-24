import DataStoreService from './DataStoreService.js';
import ServerLoggingService from './ServerLoggingService.js';
import ChatProcessingService from './ChatProcessingService.js';
import { v4 as uuidv4 } from 'uuid';
import { Chat } from '../models/chat.js';

class BatchProcessingService {
  /**
   * Creates a new batch and begins processing it.
   * @param {Object} params - Batch creation parameters
   * @returns {Promise<Object>} The created Batch document
   */
  async createBatch({ name, type, aiProvider, searchProvider, pageLanguage, applyOverrides, uploaderUserId, entries }) {
    ServerLoggingService.info('Creating new batch', { name, type });
    try {
      const records = entries;
      if (!records || records.length === 0) {
        throw new Error('No valid records provided');
      }
      // Validate required columns
      const requiredColumns = ['REDACTEDQUESTION'];
      const missingColumns = requiredColumns.filter(col => !records[0].hasOwnProperty(col));
      if (missingColumns.length > 0) {
        throw new Error(`Entries missing required columns: ${missingColumns.join(', ')}`);
      }
      // Create a Chat for each entry and collect their _ids (for population)
      const chatIds = [];
      for (const record of records) {
        const chatId = record.chatId || uuidv4();
        const chatDoc = await Chat.create({
          chatId,
          aiProvider,
          searchProvider,
          pageLanguage,
          interactions: [],
        });
        chatIds.push(chatDoc._id); // Store the ObjectId for population
      }
      // Create batch document with chat references and keep entries for recovery
      const batch = await DataStoreService.createBatchRun({
        name,
        type,
        aiProvider,
        searchProvider,
        pageLanguage,
        applyOverrides,
        uploaderUserId,
        status: 'queued',
        totalItems: chatIds.length,
        processedItems: 0,
        failedItems: 0,
        chats: chatIds,
        entries: records, // Keep for recovery/start/stop
      });
      return batch;
    } catch (error) {
      ServerLoggingService.error('Error creating batch:', error);
      throw error;
    }
  }

 

  /**
   * Process batch items for a specified duration (in seconds), resuming from lastProcessedIndex.
   * Returns progress and lastProcessedIndex for resuming.
   * @param {string} batchId - The batch document ID
   * @param {number} duration - Max duration (seconds) to process
   * @param {number} [lastProcessedIndex=0] - Index to resume from
   * @returns {Object} Progress info and lastProcessedIndex
   */
  async processBatchForDuration(batchId, duration, lastProcessedIndex = null) {
    const startTime = Date.now();
    let processedCount = 0;
    let failedCount = 0;
    let batch = await DataStoreService.findBatchRunById(batchId);
    let index = lastProcessedIndex;
    if (index === null || typeof index === 'undefined') {
      index = batch.lastProcessedIndex || 0;
    }
    const MAX_RETRIES = 3;
    while (index < batch.chats.length && (Date.now() - startTime) / 1000 < duration) {
      const chatObjectId = batch.chats[index];
      const record = batch.entries[index];
      let retryCount = 0;
      let success = false;
      // Fetch the Chat document to get the chatId (UUID string)
      const chatDoc = await Chat.findById(chatObjectId);
      if (!chatDoc) {
        failedCount++;
        ServerLoggingService.error('Chat not found for batch processing (timed)', batchId, { chatObjectId, index });
        index++;
        continue;
      }
      while (!success && retryCount < MAX_RETRIES) {
        try {
          ServerLoggingService.info('Processing batch chat (timed)', batchId, { chatObjectId, index, attempt: retryCount + 1 });
          await ChatProcessingService.processMessage({
            chatId: chatDoc.chatId, // Pass the UUID string
            userMessage: record.REDACTEDQUESTION,
            lang: batch.pageLanguage,
            selectedAI: batch.aiProvider,
            selectedSearch: batch.searchProvider,
            referringUrl: record.REFERRINGURL,
            user: { _id: batch.uploaderUserId },
            overrideUserId: batch.applyOverrides ? batch.uploaderUserId : null
          });
          processedCount++;
          success = true;
        } catch (error) {
          retryCount++;
          if (retryCount === MAX_RETRIES) {
            failedCount++;
            ServerLoggingService.error('Batch chat failed all retries (timed):', batchId, { chatObjectId, error: error.message });
            await DataStoreService.updateBatchRun(batch._id, { $inc: { failedItems: 1 } });
          } else {
            ServerLoggingService.warn('Batch chat failed, retrying (timed):', batchId, { chatObjectId, attempt: retryCount, error: error.message });
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          }
        }
      }
      // Persist progress and lastProcessedIndex after each chat
      await DataStoreService.updateBatchRun(batch._id, {
        $set: {
          processedItems: batch.processedItems + processedCount,
          failedItems: batch.failedItems + failedCount,
          lastProcessedIndex: index + 1,
          status: index + 1 === batch.chats.length ? 'completed' : 'processing'
        }
      });
      index++;
    }
    // Refresh batch status
    batch = await DataStoreService.findBatchRunById(batchId);
    const isComplete = batch.processedItems + batch.failedItems >= batch.totalItems;
    if (isComplete && batch.status !== 'completed') {
      await DataStoreService.updateBatchRun(batch._id, { $set: { status: 'completed' } });
    }
    return {
      processedCount: batch.processedItems,
      failedCount: batch.failedItems,
      totalItems: batch.totalItems,
      status: batch.status,
      lastProcessedIndex: batch.lastProcessedIndex < batch.chats.length ? batch.lastProcessedIndex : null,
      isComplete
    };
  }
}

// Export a singleton instance
export default new BatchProcessingService();
