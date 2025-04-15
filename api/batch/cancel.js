import dbConnect from '../../api/db/db-connect.js';
import { Batch } from '../../models/batch.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';
import DataStoreService from '../../services/DataStoreService.js';

async function cancelBatchHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { batchId } = req.body;
  if (!batchId) {
    return res.status(400).json({ message: 'batchId is required' });
  }

  try {
    await dbConnect();

    const batch = await Batch.findById(batchId);
    if (!batch) {
      ServerLoggingService.warn('Attempted to cancel non-existent batch', batchId);
      return res.status(404).json({ message: 'Batch not found' });
    }

    // Verify user owns this batch
    if (batch.uploaderUserId.toString() !== req.user._id.toString()) {
      ServerLoggingService.warn('Unauthorized batch cancel attempt', batchId, {
        userId: req.user._id
      });
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update batch status to cancelled
    await DataStoreService.updateBatchRun(batch._id, {
      $set: { status: 'cancelled' }
    });

    ServerLoggingService.info('Batch cancelled successfully', batchId);
    res.status(200).json({ message: 'Batch cancelled successfully' });

  } catch (error) {
    ServerLoggingService.error('Error cancelling batch', batchId, error);
    res.status(500).json({ message: 'Failed to cancel batch' });
  }
}

export default withProtection(cancelBatchHandler, authMiddleware, adminMiddleware);