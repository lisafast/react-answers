import dbConnect from './db-connect.js';
import { Batch } from '../../models/batch.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';

async function batchListHandler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await dbConnect();
    const batches = await Batch.find({}).sort({ createdAt: -1 });
    res.status(200).json(batches);
  } catch (error) {
    console.error('Error retrieving batches:', error);
    res.status(500).json({ message: 'Failed to retrieve batches', error: error.message });
  }
}

export default function handler(req, res) {
  return withProtection(batchListHandler, authMiddleware, adminMiddleware)(req, res);
}