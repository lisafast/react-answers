import dbConnect from './db-connect.js';
import { Batch } from '../../models/batch.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';

async function batchRetrieveHandler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { batchId } = req.query;

    if (!batchId) {
        return res.status(400).json({ message: 'Batch ID is required' });
    }

    try {
        await dbConnect();
        const batch = await Batch.findOne({ batchId }).populate({
            path: 'interactions',
            populate: [
                { path: 'context' },
                { path: 'expertFeedback' },
                { path: 'question' },
                {
                    path: 'answer',
                    populate: [
                        { path: 'sentences' },
                        { path: 'citation' }
                    ]
                }
            ]
        });

        if (!batch) {
            return res.status(404).json({ message: 'Batch not found' });
        }

        return res.status(200).json(batch);
    } catch (error) {
        console.error('Error retrieving batch:', error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}

export default function handler(req, res) {
    return withProtection(batchRetrieveHandler, authMiddleware, adminMiddleware)(req, res);
}