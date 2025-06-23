import dbConnect from './db-connect.js';
import { Chat } from '../../models/chat.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await dbConnect();
    const chats = await Chat.find({ user: { $exists: false } })
      .populate({ path: 'interactions', populate: { path: 'context' } });

    const items = [];
    for (const chat of chats) {
      for (const interaction of chat.interactions) {
        if (!interaction.expertFeedback) {
          items.push({
            chatId: chat.chatId,
            department: interaction.context?.department || '',
          });
        }
      }
    }

    res.status(200).json({ chats: items });
  } catch (error) {
    console.error('Error fetching public evaluation list:', error);
    res.status(500).json({ message: 'Failed to fetch list', error: error.message });
  }
}

export default function handlerWrapper(req, res) {
  return withProtection(handler, authMiddleware, adminMiddleware)(req, res);
}
