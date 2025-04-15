import dbConnect from '../db/db-connect.js';
import { Batch } from '../../models/batch.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';
import DataStoreService from '../../services/DataStoreService.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';

async function getBatchResultsHandler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { batchId } = req.query;
  if (!batchId) {
    return res.status(400).json({ message: 'batchId is required' });
  }

  try {
    await dbConnect();
    // Use DataStoreService to deeply populate batch and its interactions
    const batch = await DataStoreService.findBatchRunWithPopulatedInteractions(batchId);
    if (!batch) {
      ServerLoggingService.warn('Batch not found', batchId);
      return res.status(404).json({ message: 'Batch not found' });
    }
    // Verify user owns this batch
    if (batch.uploaderUserId.toString() !== req.user._id.toString()) {
      ServerLoggingService.warn('Unauthorized batch access attempt', batchId, { 
        userId: req.user._id 
      });
      return res.status(403).json({ message: 'Access denied' });
    }
    ServerLoggingService.info('Batch results retrieved successfully', batchId);
    res.status(200).json(batch);
  } catch (error) {
    ServerLoggingService.error('Error retrieving batch results', batchId, error);
    res.status(500).json({ message: 'Failed to retrieve batch results' });
  }
}

export default withProtection(getBatchResultsHandler, authMiddleware, adminMiddleware);