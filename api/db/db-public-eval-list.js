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
      // Lookup context for all filtered interactions (will pick most recent in JS)
      {
        $lookup: {
          from: 'contexts',
          localField: 'filteredInteractions.context',
          foreignField: '_id',
          as: 'contextDocs',
        },
      },
      {
        $project: {
          chatId: 1,
          filteredInteractions: 1,
          contextDocs: 1,
          updatedAt: 1,
          createdAt: 1,
        },
      },
    ]);

    // Post-process in JS to find the most recent filtered interaction and its context
    const items = chats.map((chat) => {
      // Sort filteredInteractions by updatedAt or createdAt descending
      const sortedInteractions = [...chat.filteredInteractions].sort((a, b) => {
        const dateA = a.updatedAt || a.createdAt || 0;
        const dateB = b.updatedAt || b.createdAt || 0;
        return new Date(dateB) - new Date(dateA);
      });
      const mostRecentInteraction = sortedInteractions[0];
      // Find the context for the most recent interaction
      let department = '';
      if (mostRecentInteraction && mostRecentInteraction.context && chat.contextDocs) {
        const contextDoc = chat.contextDocs.find(
          (ctx) => ctx._id.toString() === mostRecentInteraction.context.toString()
        );
        department = contextDoc ? contextDoc.department : '';
      }
      // Determine the date
      const date = mostRecentInteraction && (mostRecentInteraction.updatedAt || mostRecentInteraction.createdAt || chat.updatedAt || chat.createdAt);
      return {
        chatId: chat.chatId,
        department,
        date: date ? new Date(date).toISOString() : '',
      };
    });

    res.status(200).json({ chats: items });
  } catch (error) {
    console.error('Error fetching public evaluation list:', error);
    res.status(500).json({ message: 'Failed to fetch list', error: error.message });
  }
}

export default function handlerWrapper(req, res) {
  return withProtection(handler, authMiddleware, adminMiddleware)(req, res);
}
