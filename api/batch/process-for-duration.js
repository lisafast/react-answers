import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';
import BatchProcessingService from '../../services/BatchProcessingService.js';
import DataStoreService from '../../services/DataStoreService.js';
import SettingsService from '../../services/SettingsService.js';
import dbConnect from '../db/db-connect.js';

async function processForDurationHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  try {
    const { batchId } = req.body;
    if (!batchId) {
      return res.status(400).json({ message: 'batchId is required' });
    }
    await dbConnect();
    // Find the batch and its entries
    const batch = await DataStoreService.findBatchRunById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }
    // Only allow the uploader to process their batch
    if (batch.uploaderUserId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    // Get the entries from the batch (assume stored in batch.entries or reload from source)
    const entries = batch.entries || [];
    // Fetch duration from settings
    const duration = await SettingsService.getBatchDuration();
    // Run the processBatchForDuration method
    const result = await BatchProcessingService.processBatchForDuration(batchId, entries, duration);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to process batch for duration', error: error.message });
  }
}

export default withProtection(processForDurationHandler, authMiddleware, adminMiddleware);
