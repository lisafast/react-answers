import dbConnect from './db-connect.js';
import { Logs } from '../../models/logs.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';

async function deleteSystemLogsHandler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  try {
    await dbConnect();
    const result = await Logs.deleteMany({ chatId: 'system' });
    return res.status(200).json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Deleted ${result.deletedCount} system logs.`
    });
  } catch (error) {
    console.error('Error deleting system logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete system logs',
      error: error.message
    });
  }
}

export default function handler(req, res) {
  return withProtection(deleteSystemLogsHandler, authMiddleware, adminMiddleware)(req, res);
}
