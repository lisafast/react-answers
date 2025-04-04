// api/batch/create.js - Handles creation of new batch processing runs
import ServerLoggingService from '../../services/ServerLoggingService.js';
import BatchProcessingService from '../../services/BatchProcessingService.js';
// Import authentication/authorization middleware if needed
// import authMiddleware from '../../middleware/auth.js'; 

async function createBatchHandler(req, res) {
  // Optional: Apply authentication middleware first
  // await authMiddleware(req, res); 
  // if (res.writableEnded) return; // Stop if auth failed

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const batchIdForLogging = 'batch-creation'; // Use a generic ID before batchId is generated

  try {
    const {
      name,       // User-provided name for the batch
      type,       // Type of batch (e.g., 'evaluation')
      aiProvider, // AI provider to use
      pageLanguage, // Language for processing
      items       // Array of items to process [{ question: '...', context: {...} }, ...]
    } = req.body;

    // Basic validation
    if (!name || !type || !aiProvider || !pageLanguage || !Array.isArray(items) || items.length === 0) {
      ServerLoggingService.warn('Create Batch API request missing required fields', batchIdForLogging, req.body);
      return res.status(400).json({ message: 'Missing required fields: name, type, aiProvider, pageLanguage, items (non-empty array)' });
    }

    ServerLoggingService.info('Create Batch API request received', batchIdForLogging, { name, type, itemCount: items.length });

    // Call the BatchProcessingService to queue the run
    const batchResult = await BatchProcessingService.queueBatchRun(
      name,
      type,
      aiProvider,
      pageLanguage,
      items
    );

    // Send success response with the batchId
    res.status(202).json({ // 202 Accepted is appropriate as processing is deferred
      message: 'Batch run successfully queued.',
      batchId: batchResult.batchId,
      status: batchResult.status,
      totalItems: batchResult.totalItems
    });
    ServerLoggingService.info('Batch run queued successfully', batchResult.batchId);

  } catch (error) {
    ServerLoggingService.error('Error creating batch run in API handler:', batchIdForLogging, error);
    
    const statusCode = error.statusCode || 500;
    const errorMessage = error.isClientSafe ? error.message : 'Failed to queue batch run due to an internal server error.';
    
    if (!res.headersSent) {
       res.status(statusCode).json({ message: errorMessage });
    } else if (!res.writableEnded) {
       res.end(); // End the response if possible
    }
  }
}

export default createBatchHandler;
