import dbConnect from './db-connect.js';
import { Chat } from '../../models/chat.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await dbConnect();
    // Correct aggregation for referenced interactions
    const chats = await Chat.aggregate([
      { $match: { user: { $exists: false } } },
      // Lookup interactions from Interaction collection
      {
        $lookup: {
          from: 'interactions',
          localField: 'interactions',
          foreignField: '_id',
          as: 'interactionDocs',
        },
      },
      { $unwind: '$interactionDocs' },
      // Only interactions without expertFeedback (null or missing)
      { $match: {
          $or: [
            { 'interactionDocs.expertFeedback': { $exists: false } },
            { 'interactionDocs.expertFeedback': null }
          ]
        }
      },
      // Lookup context for each interaction
      {
        $lookup: {
          from: 'contexts',
          localField: 'interactionDocs.context',
          foreignField: '_id',
          as: 'contextDoc',
        },
      },
      {
        $addFields: {
          'interactionDocs.context': { $arrayElemAt: ['$contextDoc', 0] },
        },
      },
      {
        $project: {
          chatId: 1,
          interactionDocs: 1,
          updatedAt: 1,
          createdAt: 1,
        },
      },
      {
        $addFields: {
          date: {
            $ifNull: [
              '$interactionDocs.updatedAt',
              { $ifNull: ['$interactionDocs.createdAt', { $ifNull: ['$updatedAt', '$createdAt'] }] },
            ],
          },
        },
      },
      { $sort: { date: -1 } },
    ]);

    const items = chats.map((chat) => ({
      chatId: chat.chatId,
      department: chat.interactionDocs?.context?.department || '',
      date: chat.date || '',
    }));

    res.status(200).json({ chats: items });
  } catch (error) {
    console.error('Error fetching public evaluation list:', error);
    res.status(500).json({ message: 'Failed to fetch list', error: error.message });
  }
}

export default function handlerWrapper(req, res) {
  return withProtection(handler, authMiddleware, adminMiddleware)(req, res);
}
