import DataStoreService from './DataStoreService.js';
import ServerLoggingService from './ServerLoggingService.js';
import { v4 as uuidv4 } from 'uuid'; // For generating unique batch IDs if needed

// Placeholder for the actual job queue implementation
// import { batchQueue } from '../queues/batchQueue.js'; // Example: Assuming a BullMQ setup

/**
 * Service responsible for managing the lifecycle of batch processing jobs.
 */
class BatchProcessingService {

  /**
   * Creates a new batch run record and queues individual jobs for each item.
   *
   * @param {string} name - User-provided name for the batch.
   * @param {string} type - Type of batch (e.g., 'evaluation', 'processing').
   * @param {string} aiProvider - AI provider to use.
   * @param {string} pageLanguage - Language for processing.
   * @param {Array<object>} items - Array of items to process (e.g., { question: '...', context: {...} }).
   * @returns {Promise<object>} The created Batch document summary (e.g., { batchId, status }).
   */
  async queueBatchRun(name, type, aiProvider, pageLanguage, items) {
    const batchId = uuidv4(); // Generate a unique ID for this batch run
    const totalItems = items.length;
    const status = 'queued'; // Initial status

    ServerLoggingService.info('Queueing new batch run', batchId, { name, type, aiProvider, pageLanguage, totalItems });

    try {
      // 1. Create the Batch record in the database
      const batchData = {
        batchId,
        name,
        type,
        aiProvider,
        pageLanguage,
        status,
        totalItems,
        processedItems: 0,
        failedItems: 0,
        interactions: [] // Interactions will be linked by the job worker
      };
      const createdBatch = await DataStoreService.createBatchRun(batchData);
      ServerLoggingService.info('Batch record created', batchId, { dbId: createdBatch._id });

      // 2. Add a job to the queue for each item
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const jobData = {
          batchId: batchId, // Link job back to the batch run
          itemIndex: i,
          itemData: item, // The actual data for this item (e.g., question, context)
          aiProvider: aiProvider,
          pageLanguage: pageLanguage,
          // Add any other necessary config for processing
        };

        // Add job to the queue (replace with actual queue implementation)
        // await batchQueue.add(`processItem-${batchId}-${i}`, jobData); 
        console.log(`Placeholder: Adding job for item ${i} of batch ${batchId} to queue.`); 
      }

      ServerLoggingService.info('All jobs queued for batch run', batchId);

      // Return essential info about the created batch
      return {
        batchId: createdBatch.batchId,
        status: createdBatch.status,
        totalItems: createdBatch.totalItems,
        _id: createdBatch._id
      };

    } catch (error) {
      ServerLoggingService.error('Error queueing batch run', batchId, error);
      // Attempt to update batch status to 'error' if possible? Or handle cleanup?
      throw new Error(`Failed to queue batch run: ${error.message}`);
    }
  }

  // Methods for handling job completion/failure updates could go here,
  // though often the job worker itself updates the DataStore directly.
  // Example:
  // async handleJobCompletion(batchId, itemIndex) { ... }
  // async handleJobFailure(batchId, itemIndex, error) { ... }

}

// Export a singleton instance
export default new BatchProcessingService();
