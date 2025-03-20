import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';
import { Batch } from '../../models/batch.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  headers: {
    'anthropic-beta': 'message-batches-2024-09-24'
  }
});

async function batchStatusHandler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { batchId } = req.query;
    
    if (!batchId) {
      return res.status(400).json({ error: 'Batch ID is required' });
    }

    const messageBatch = await anthropic.beta.messages.batches.retrieve(batchId);
    let result = null;
    console.log(`Batch ${messageBatch.id} processing status is ${messageBatch.processing_status}`);

    if (messageBatch.processing_status === 'ended' && messageBatch.results_url) {
      result = {
        status: "completed",
      };
      return res.status(200).json(result);
    } else {
      result = {
        status: "processing",
      };
      return res.status(200).json(result);
    }
  } catch (error) {
    console.error('Error checking batch status:', error);
    return res.status(500).json({ error: 'Error checking batch status', details: error.message });
  }
}

export default function handler(req, res) {
  return withProtection(batchStatusHandler, authMiddleware, adminMiddleware)(req, res);
}




