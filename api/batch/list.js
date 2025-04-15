import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';
import DataStoreService from '../../services/DataStoreService.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';

async function listBatchesHandler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    const batches = await DataStoreService.findAllBatches();
    
    ServerLoggingService.info('All batches retrieved successfully', null, { 
      count: batches.length 
    });

    res.status(200).json(batches);

  } catch (error) {
    ServerLoggingService.error('Error retrieving batches', null, error);
    res.status(500).json({ message: 'Failed to retrieve batches' });
  }
}

export default withProtection(listBatchesHandler, authMiddleware, adminMiddleware);