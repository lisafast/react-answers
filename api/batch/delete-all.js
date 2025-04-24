import dbConnect from '../db/db-connect.js';
import { Batch } from '../../models/batch.js';
import { Chat } from '../../models/chat.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';

async function deleteAllBatchesHandler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();

    // Find all batches and collect all related chat IDs
    const batches = await Batch.find({});
    const allChatIds = batches.flatMap(batch => batch.chats || []);

    // Delete all batches
    await Batch.deleteMany({});

    // Delete all related chats (cascading will handle their children)
    if (allChatIds.length > 0) {
      await Chat.deleteMany({ _id: { $in: allChatIds } });
    }

    return res.status(200).json({
      success: true,
      message: `Deleted ${batches.length} batches and ${allChatIds.length} related chats (with cascading).`
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Failed to delete all batches',
      details: error.message
    });
  }
}

export default withProtection(deleteAllBatchesHandler, authMiddleware, adminMiddleware);

