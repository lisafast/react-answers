import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { batchId } = req.query;
        const batch = await openai.batches.retrieve(batchId);

        const status = batch.status === 'completed' ? 'completed' : batch.status === 'failed' ? 'failed' : 'processing';
        return res.status(200).json({ status });
    } catch (error) {
        console.error('OpenAI Batch status error:', error);
        return res.status(500).json({ error: 'Failed to get batch status' });
    }
} 