import dbConnect from './db-connect.js';
import { Chat } from '../../models/chat.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';

async function chatLogsHandler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        await dbConnect();
        console.log('DB Connected in chat-logs endpoint');

        const totalCount = await Chat.countDocuments();
        console.log('Total documents in collection:', totalCount);

        let chats;
        const daysParam = req.query.days;
        const chatPopulate = [
            { path: 'user', select: 'email' }, // <-- populate user email
            {
                path: 'interactions',
                populate: [
                    { path: 'context' },
                    {
                        path: 'expertFeedback',
                        model: 'ExpertFeedback',
                        select: '-__v'
                    },
                    {
                        path: 'publicFeedback',
                        model: 'PublicFeedback',
                        select: '-__v'
                    },
                    { 
                        path: 'question',
                        select: '-embedding'
                    },
                    {
                        path: 'answer',
                        select: '-embedding -sentenceEmbeddings',
                        populate: [
                            { path: 'sentences' },
                            { path: 'citation' },
                            { path: 'tools' },
                        ]
                    },
                    {
                        path: 'autoEval',
                        model: 'Eval',
                        populate: {
                            path: 'expertFeedback',
                            model: 'ExpertFeedback',
                            select: '-__v'
                        }
                    }
                ]
            }
        ];
        if (daysParam === 'all') {
            // Return all logs
            chats = await Chat.find({})
                .populate(chatPopulate)
                .sort({ createdAt: -1 });
        } else {
            const days = parseInt(daysParam) || 1;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            chats = await Chat.find({
                createdAt: { $gte: startDate }
            })
                .populate(chatPopulate)
                .sort({ createdAt: -1 });
        }

        return res.status(200).json({
            success: true,
            logs: chats
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            error: 'Failed to fetch logs',
            details: error.message
        });
    }
}

export default function handler(req, res) {
    return withProtection(chatLogsHandler, authMiddleware, adminMiddleware)(req, res);
}
