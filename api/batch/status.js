// api/batch/status.js - Handles requests for batch run status
import { withProtection } from '../../middleware/auth.js';
import DataStoreService from '../../services/DataStoreService.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';
import dbConnect from '../../api/db/db-connect.js';
import { Batch } from '../../models/batch.js';

async function batchStatusHandler(req, res) {
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

    const batch = await Batch.findOne({
      _id: batchId,
      uploaderUserId: req.user._id
    }).select('name status totalItems processedItems failedItems aiProvider searchProvider pageLanguage createdAt updatedAt');

    if (!batch) {
      ServerLoggingService.warn('Batch not found or access denied', batchId);
      return res.status(404).json({ message: 'Batch not found or access denied' });
    }

    ServerLoggingService.info('Batch status retrieved successfully', batchId, { 
      status: batch.status,
      processedItems: batch.processedItems,
      failedItems: batch.failedItems
    });

    res.status(200).json(batch);

  } catch (error) {
    ServerLoggingService.error('Error retrieving batch status:', batchId, error);
    res.status(500).json({ message: 'Failed to retrieve batch status' });
  }
}

export default withProtection(batchStatusHandler);
