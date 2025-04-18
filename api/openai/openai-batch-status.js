import { createDirectOpenAIClient } from '../../agents/AgentService.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';

const openai = createDirectOpenAIClient();

async function batchStatusHandler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { batchId } = req.query;
        const batch = await openai.batches.retrieve(batchId);

        return res.status(200).json({
            status: batch.status,
        });
    } catch (error) {
        return res.status(200).json({
            status: "not_found",
        });
    }
}

export default function handler(req, res) {
    return withProtection(batchStatusHandler, authMiddleware, adminMiddleware)(req, res);
}