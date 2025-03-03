// api/chat-logs.js to retrieve logs from the database for evaluation purposes
import dbConnect from './db-connect.js';
import { Chat } from '../models/chat.js';
import { Logs } from '../models/logs.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    console.log('DB Connected in chat-logs endpoint');

    const totalCount = await Chat.countDocuments();
    console.log('Total documents in collection:', totalCount);

    const days = parseInt(req.query.days) || 1;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const chats = await Chat.find({
      createdAt: { $gte: startDate }
    })
      .populate({
        path: 'interactions',
        populate: [
          { path: 'context'},
          { path: 'expertFeedback' },
          { path: 'question' },
          {
            path: 'answer',
            populate: [
              { path: 'sentences' },
              { path: 'citation' }
            ]
          }
        ]
      })
      .sort({ createdAt: -1 });

    // For each chat, find related download logs
    for (const chat of chats) {
      console.log(`Looking for logs for chat ${chat.chatId}`);
      
      // Find download start logs (including error logs)
      const downloadStartLogs = await Logs.find({
        chatId: chat.chatId,
        logLevel: 'info',
        'metadata.action': 'download_start'
      }).lean();

      // Find download complete logs
      const downloadCompleteLogs = await Logs.find({
        chatId: chat.chatId,
        logLevel: 'info',
        'metadata.action': 'download_complete'
      }).lean();

      console.log(`Found logs for chat ${chat.chatId}:`, {
        starts: downloadStartLogs.length,
        completes: downloadCompleteLogs.length
      });

      if (downloadStartLogs.length > 0) {
        console.log('Download start logs found:', JSON.stringify(downloadStartLogs, null, 2));
      }

      // Add these logs to the chat object
      chat.downloadStartLogs = downloadStartLogs;
      chat.downloadCompleteLogs = downloadCompleteLogs;
    }

    console.log('Returning chats with logs:', chats.map(chat => ({
      chatId: chat.chatId,
      hasStartLogs: chat.downloadStartLogs?.length > 0,
      hasCompleteLogs: chat.downloadCompleteLogs?.length > 0
    })));

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
