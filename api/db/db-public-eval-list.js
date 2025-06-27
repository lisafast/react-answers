import dbConnect from './db-connect.js';
import { Chat } from '../../models/chat.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await dbConnect();
    // Aggregate per chat, not per interaction
    const chats = await Chat.aggregate([
      { $match: { user: { $exists: false } } },
      {
        $lookup: {
          from: 'interactions',
          localField: 'interactions',
          foreignField: '_id',
          as: 'interactionDocs',
        },
      },
      // Filter interactions without expertFeedback
      {
        $addFields: {
          filteredInteractions: {
            $filter: {
              input: '$interactionDocs',
              as: 'interaction',
              cond: {
                $or: [
                  { $eq: ['$$interaction.expertFeedback', null] },
                  { $eq: ['$$interaction.expertFeedback', undefined] },
                  { $not: { $ifNull: ['$$interaction.expertFeedback', false] } }
                ]
              }
            }
          }
        }
      },
      // Only keep chats with at least one such interaction
      { $match: { 'filteredInteractions.0': { $exists: true } } },
      // Lookup context for the most recent filtered interaction
      {
        $addFields: {
          mostRecentInteraction: {
            $arrayElemAt: [
              {
                $slice: [
                  {
                    $reverseArray: {
                      $sortArray: {
                        input: '$filteredInteractions',
                        sortBy: { updatedAt: 1, createdAt: 1 }
                      }
                    }
                  },
                  1
                ]
              },
              0
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'contexts',
          localField: 'mostRecentInteraction.context',
          foreignField: '_id',
          as: 'contextDoc',
        },
      },
      {
        $addFields: {
          'mostRecentInteraction.context': { $arrayElemAt: ['$contextDoc', 0] },
        },
      },
      {
        $addFields: {
          date: {
            $ifNull: [
              '$mostRecentInteraction.updatedAt',
              { $ifNull: ['$mostRecentInteraction.createdAt', { $ifNull: ['$updatedAt', '$createdAt'] }] },
            ],
          },
        },
      },
      {
        $project: {
          chatId: 1,
          department: '$mostRecentInteraction.context.department',
          date: 1,
        },
      },
      { $sort: { date: -1 } },
    ]);

    const items = chats.map((chat) => ({
      chatId: chat.chatId,
      department: chat.department || '',
      date: chat.date ? new Date(chat.date).toISOString() : '',
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
