import ChatProcessingService from '../../services/ChatProcessingService.js';
import DataStoreService from '../../services/DataStoreService.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';
import { rateLimitMiddleware } from '../../middleware/rateLimitMiddleware.js';

export default async function backgroundTaskHandler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Add rate limiting middleware for consistency
  const allowed = await rateLimitMiddleware(req, res);
  if (!allowed) return; // Middleware already handled the response

  try {
    const { interactionId, chatId, requestId } = req.body;
    if (!interactionId || !chatId) {
      res.status(400).json({ error: 'Missing interactionId or chatId' });
      return;
    }
    // Find the saved interaction document
    const savedInteraction = await DataStoreService.findInteractionById(interactionId);
    if (!savedInteraction) {
      res.status(404).json({ error: 'Interaction not found' });
      return;
    }
    await ChatProcessingService.runBackgroundTaskWorkers(savedInteraction, chatId, requestId);
    res.status(200).json({ status: 'Background tasks started' });
  } catch (error) {
    ServerLoggingService.error('Error in backgroundTaskHandler', null, { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to start background tasks', details: error.message });
  }
}
