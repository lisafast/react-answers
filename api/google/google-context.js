import { invokeContextAgent } from '../../services/ContextAgentService.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';
import { authMiddleware, withProtection } from '../../middleware/auth.js';

async function invokeHandler(req, res) {
    if (req.method === 'POST') {
        try {
            const request = req.body;
            ServerLoggingService.info('Google Context API request received', request.chatId);
            ServerLoggingService.debug('Request body:', request.chatId, request);

            const result = await invokeContextAgent('google', request);
            res.json(result);
        } catch (error) {
            console.error('Error in Google context handler:', error);
            ServerLoggingService.error('Error processing Google context request:', request?.chatId, error);
            res.status(500).json({ error: 'Failed to process Google context request' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

export default function handler(req, res) {
    return withProtection(invokeHandler, authMiddleware)(req, res);
}