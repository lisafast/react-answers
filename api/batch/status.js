// api/batch/status.js - Handles requests for batch run status
import ServerLoggingService from '../../services/ServerLoggingService.js';
import DataStoreService from '../../services/DataStoreService.js';
// Import authentication/authorization middleware if needed
// import authMiddleware from '../../middleware/auth.js'; 

async function batchStatusHandler(req, res) {
  // Optional: Apply authentication middleware first
  // await authMiddleware(req, res); 
  // if (res.writableEnded) return; // Stop if auth failed

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { batchId } = req.query; // Get batchId from query parameters

  if (!batchId) {
    return res.status(400).json({ message: 'Missing required query parameter: batchId' });
  }

  ServerLoggingService.info('Batch Status API request received', batchId);

  try {
    // Call DataStoreService to find the batch run by its ID
    // Assuming findBatchRunById finds using the 'batchId' field, not MongoDB '_id'
    const batchRun = await DataStoreService.findBatchRunById(batchId); 

    if (!batchRun) {
      ServerLoggingService.warn('Batch run not found for status check', batchId);
      return res.status(404).json({ message: `Batch run with ID ${batchId} not found.` });
    }

    // Send success response with the batch status and progress
    res.status(200).json({
      batchId: batchRun.batchId,
      name: batchRun.name,
      status: batchRun.status,
      totalItems: batchRun.totalItems,
      processedItems: batchRun.processedItems,
      failedItems: batchRun.failedItems,
      createdAt: batchRun.createdAt,
      updatedAt: batchRun.updatedAt,
      // Optionally include interaction IDs if needed, though might be large
      // interactionCount: batchRun.interactions?.length || 0 
    });
    ServerLoggingService.info('Batch status retrieved successfully', batchId, { status: batchRun.status });

  } catch (error) {
    ServerLoggingService.error('Error retrieving batch status in API handler:', batchId, error);
    
    const statusCode = error.statusCode || 500;
    const errorMessage = error.isClientSafe ? error.message : 'Failed to retrieve batch status due to an internal server error.';
    
    if (!res.headersSent) {
       res.status(statusCode).json({ message: errorMessage });
    } else if (!res.writableEnded) {
       res.end(); // End the response if possible
    }
  }
}

export default batchStatusHandler;
