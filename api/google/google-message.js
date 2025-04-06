import { createGoogleAgent } from '../../agents/AgentService.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';
import { authMiddleware, withProtection } from '../../middleware/auth.js';

const NUM_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second

const convertInteractionsToMessages = (interactions) => {
    let messages = [];
    // Reverse the interactions array to process them in reverse order.
    const reversedInteractions = [...interactions].reverse();
    for (let i = reversedInteractions.length - 1; i >= 0; i--) {
        messages.push({
            role: "user",
            content: reversedInteractions[i].interaction.question,
        });

        messages.push({
            role: "assistant",
            content: reversedInteractions[i].interaction.answer.content,
        });
    }
    return messages;
};

async function invokeHandler(req, res) {
    if (req.method === 'POST') {
        try {
            const { message, systemPrompt, conversationHistory, chatId = 'system', selectedModel } = req.body;
            ServerLoggingService.info('Google AI API request received', chatId);
            ServerLoggingService.debug('Request body:', chatId, { message, systemPrompt, conversationHistoryLength: conversationHistory.length, selectedModel });

            const googleAgent = await createGoogleAgent(chatId, selectedModel);
            const messages = [
                {
                    role: "system",
                    content: systemPrompt,
                },
                ...convertInteractionsToMessages(conversationHistory),
                {
                    role: "user",
                    content: message,
                },
            ];

            const answer = await googleAgent.invoke({
                messages: messages,
            });

            if (Array.isArray(answer.messages) && answer.messages.length > 0) {
                answer.messages.forEach((msg, index) => {
                    ServerLoggingService.debug(`Google AI Response [${index}]:`, chatId, msg);
                });
                res.json(answer);
            } else {
                throw new Error('Invalid response format from Google AI');
            }
        } catch (error) {
            console.error('Error in Google message handler:', error);
            ServerLoggingService.error('Error processing Google AI request:', chatId, error);
            res.status(500).json({ error: 'Failed to process Google AI request' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

export default function handler(req, res) {
    return withProtection(invokeHandler, authMiddleware)(req, res);
}