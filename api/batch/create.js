// api/batch/create.js - Handles creation of new batch processing runs
import ServerLoggingService from '../../services/ServerLoggingService.js';
import BatchProcessingService from '../../services/BatchProcessingService.js';
import { authMiddleware, withProtection } from '../../middleware/auth.js';

async function createBatchHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const batchIdForLogging = 'batch-creation';

  try {
    const {
      batchName,
      aiProvider,
      searchProvider,
      lang: pageLanguage,
      applyOverrides,
      file // CSV file from multipart/form-data
    } = req.body;

    // Basic validation
    if (!batchName || !aiProvider || !searchProvider || !pageLanguage || !file) {
      ServerLoggingService.warn('Create Batch API request missing required fields', batchIdForLogging, req.body);
      return res.status(400).json({ 
        message: 'Missing required fields: batchName, aiProvider, searchProvider, lang, file' 
      });
    }

    ServerLoggingService.info('Create Batch API request received', batchIdForLogging, { 
      batchName, 
      aiProvider,
      searchProvider 
    });

    // Call the BatchProcessingService to create and queue the batch
    const batchResult = await BatchProcessingService.createBatch({
      name: batchName,
      type: 'question',
      aiProvider,
      searchProvider,
      pageLanguage,
      applyOverrides: Boolean(applyOverrides),
      uploaderUserId: req.user._id, // From auth middleware
      file
    });

    // Send success response with the batchId
    res.status(202).json({
      message: 'Batch successfully queued.',
      batchId: batchResult._id,
      status: batchResult.status,
      totalItems: batchResult.totalItems
    });
    
    ServerLoggingService.info('Batch queued successfully', batchResult._id);

  } catch (error) {
    ServerLoggingService.error('Error creating batch:', batchIdForLogging, error);
    
    const statusCode = error.statusCode || 500;
    const errorMessage = error.isClientSafe ? error.message : 'Failed to create batch due to an internal server error.';
    
    if (!res.headersSent) {
      res.status(statusCode).json({ message: errorMessage });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}

// Wrap the handler with authentication middleware
export default withProtection(createBatchHandler);
