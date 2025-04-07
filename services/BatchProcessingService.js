import DataStoreService from './DataStoreService.js';
import ServerLoggingService from './ServerLoggingService.js';
import ChatProcessingService from './ChatProcessingService.js';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';

class BatchProcessingService {
  /**
   * Creates a new batch and begins processing it.
   * @param {Object} params - Batch creation parameters
   * @returns {Promise<Object>} The created Batch document
   */
  async createBatch({ name, type, aiProvider, searchProvider, pageLanguage, applyOverrides, uploaderUserId, file }) {
    const batchId = uuidv4();
    ServerLoggingService.info('Creating new batch', batchId, { name, type });

    try {
      // Parse CSV file
      const fileContent = await file.text();
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        skip_records_with_empty_values: true
      });

      if (records.length === 0) {
        throw new Error('CSV file contains no valid records');
      }

      // Validate required columns
      const requiredColumns = ['REDACTEDQUESTION'];
      const missingColumns = requiredColumns.filter(col => !records[0].hasOwnProperty(col));
      if (missingColumns.length > 0) {
        throw new Error(`CSV missing required columns: ${missingColumns.join(', ')}`);
      }

      // Create batch document
      const batch = await DataStoreService.createBatchRun({
        batchId,
        name,
        type,
        aiProvider,
        searchProvider,
        pageLanguage,
        applyOverrides,
        uploaderUserId,
        status: 'processing',
        totalItems: records.length,
        processedItems: 0,
        failedItems: 0,
        interactions: []
      });

      // Start processing in the background
      this._processBatchItems(batch, records).catch(error => {
        ServerLoggingService.error('Background batch processing failed:', batchId, error);
        // Ensure batch is marked as failed even if background processing crashes
        DataStoreService.updateBatchRun(batch._id, {
          $set: { status: 'error' }
        }).catch(updateError => {
          ServerLoggingService.error('Failed to update batch status after error:', batchId, updateError);
        });
      });

      return batch;

    } catch (error) {
      ServerLoggingService.error('Error creating batch:', batchId, error);
      throw error;
    }
  }

  /**
   * Process batch items sequentially with error handling and progress tracking
   * @private
   */
  async _processBatchItems(batch, records) {
    let processedCount = 0;
    let failedCount = 0;
    const chatGroups = new Map(); // Group items by chatId for context preservation
    const MAX_RETRIES = 3;

    try {
      // Group records by chatId if present
      for (const record of records) {
        const chatId = record.chatId || uuidv4(); // New chat if no chatId
        if (!chatGroups.has(chatId)) {
          chatGroups.set(chatId, []);
        }
        chatGroups.get(chatId).push(record);
      }

      // Process each chat group sequentially
      for (const [chatId, groupRecords] of chatGroups) {
        let groupFailures = 0;

        // Process items in the chat group sequentially to maintain conversation context
        for (const record of groupRecords) {
          let retryCount = 0;
          let success = false;

          while (!success && retryCount < MAX_RETRIES) {
            try {
              ServerLoggingService.info('Processing batch item', batch._id, {
                chatId,
                attempt: retryCount + 1,
                question: record.REDACTEDQUESTION?.substring(0, 100)
              });

              const result = await ChatProcessingService.processMessage({
                chatId,
                userMessage: record.REDACTEDQUESTION,
                lang: batch.pageLanguage,
                selectedAI: batch.aiProvider,
                selectedSearch: batch.searchProvider,
                referringUrl: record.URL,
                user: { _id: batch.uploaderUserId },
                overrideUserId: batch.applyOverrides ? batch.uploaderUserId : null
              });

              // Add interaction to batch
              await DataStoreService.updateBatchRun(batch._id, {
                $push: { interactions: result.interactionId }
              });

              processedCount++;
              success = true;

              ServerLoggingService.info('Batch item processed successfully', batch._id, {
                chatId,
                attempt: retryCount + 1
              });

            } catch (error) {
              retryCount++;
              
              if (retryCount === MAX_RETRIES) {
                failedCount++;
                groupFailures++;
                
                ServerLoggingService.error('Batch item failed all retries:', batch._id, {
                  chatId,
                  question: record.REDACTEDQUESTION,
                  error: error.message
                });

                await DataStoreService.updateBatchRun(batch._id, {
                  $inc: { failedItems: 1 }
                });
              } else {
                ServerLoggingService.warn('Batch item failed, retrying:', batch._id, {
                  chatId,
                  attempt: retryCount,
                  error: error.message
                });
                
                // Wait before retry with exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
              }
            }
          }

          // Update progress after each item
          await DataStoreService.updateBatchRun(batch._id, {
            $set: { 
              processedItems: processedCount,
              failedItems: failedCount,
              status: processedCount + failedCount === batch.totalItems ? 'completed' : 'processing'
            }
          });
        }

        // Log chat group completion status
        if (groupFailures > 0) {
          ServerLoggingService.warn('Chat group completed with failures', batch._id, {
            chatId,
            totalItems: groupRecords.length,
            failures: groupFailures
          });
        }
      }

      // Mark batch as completed and update final counts
      const finalStatus = failedCount === records.length ? 'error' : 
                         failedCount > 0 ? 'completed_with_errors' : 
                         'completed';

      await DataStoreService.updateBatchRun(batch._id, {
        $set: { 
          status: finalStatus,
          processedItems: processedCount,
          failedItems: failedCount
        }
      });

      ServerLoggingService.info('Batch processing completed', batch._id, {
        status: finalStatus,
        processed: processedCount,
        failed: failedCount
      });

    } catch (error) {
      // Mark batch as error if something goes wrong at the batch level
      await DataStoreService.updateBatchRun(batch._id, {
        $set: { status: 'error' }
      });
      ServerLoggingService.error('Batch processing failed:', batch._id, error);
      throw error;
    }
  }
}

// Export a singleton instance
export default new BatchProcessingService();
