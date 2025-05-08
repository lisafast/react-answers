// api/chat.js - Refactored for SSE streaming via ChatProcessingService events
// Removed jwt import, using helper from auth middleware now
// import User from '../../models/user.js'; // Keep commented if not needed for role check
import ServerLoggingService from '../../services/ServerLoggingService.js';
import { verifyOptionalToken } from '../../middleware/auth.js'; // Import the new helper
import ChatProcessingService from '../../services/ChatProcessingService.js';
import statusEmitter from '../../utils/statusEmitter.js';
import { v4 as uuidv4 } from 'uuid';
import { rateLimitMiddleware } from '../../middleware/rateLimitMiddleware.js';

// Helper to format and send SSE messages
const sendSseMessage = (res, event, data) => {
  // Check if the connection is still writable before attempting to write
  if (res.writableEnded) {
    return;
  }
  try {
    const jsonData = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`event: ${event}\n`);
    res.write(`data: ${jsonData}\n\n`);
  } catch (error) {
    ServerLoggingService.error('Error writing to SSE stream:', null, error);
     if (!res.writableEnded) {
        res.end();
     }
  }
};

// Main handler function - Refactored for SSE
async function sseMessageHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const chatId = req.body?.chatId || 'system';
  const requestId = uuidv4(); // Unique ID for this specific request stream
  const eventName = `statusUpdate:${requestId}`; // Event name scoped to this request
  let isClosed = false; // Flag to prevent multiple cleanups
  let keepAliveIntervalId = null; // Variable to hold the interval ID

  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Cleanup function - ensures it only runs once
  const cleanupAndEnd = (caller = 'unknown') => {
     if (isClosed) {
       ServerLoggingService.debug(`Cleanup already called for request ${requestId}, ignoring call from: ${caller}`, chatId);
       return;
     }
     isClosed = true;
     ServerLoggingService.debug(`Cleaning up SSE listener for request ${requestId} (called by: ${caller})`, chatId);
     statusEmitter.off(eventName, handleStatusUpdate); // Clean up listener
     // Clear the keep-alive interval
     if (keepAliveIntervalId) {
        clearInterval(keepAliveIntervalId);
        keepAliveIntervalId = null;
        ServerLoggingService.debug(`Cleared keep-alive interval for request ${requestId}`, chatId);
     }
     if (!res.writableEnded) {
        res.end(); // End the SSE stream gracefully
        ServerLoggingService.debug(`SSE stream ended for request ${requestId} (called by: ${caller})`, chatId);
     } else {
        ServerLoggingService.debug(`SSE stream already ended for request ${requestId} when cleanup called by: ${caller}`, chatId);
     }
  };

  // Function to handle status updates for THIS request
  const handleStatusUpdate = (eventData) => {
    ServerLoggingService.debug(`SSE Handler received event for request ${requestId}`, chatId, eventData);
    sendSseMessage(res, eventData.type, eventData.data);

    // If it's a final event, clean up and close
    if (eventData.type === 'processing_complete' || eventData.type === 'processing_error') {
       cleanupAndEnd(`handleStatusUpdate (${eventData.type})`);
    }
  };

  // Subscribe to events for this specific request
  statusEmitter.on(eventName, handleStatusUpdate);
  ServerLoggingService.debug(`SSE Listener attached for request ${requestId}`, chatId);

  // Handle client disconnect
  res.on('close', () => {
    ServerLoggingService.debug(`SSE connection closed by client for request ${requestId}`, chatId);
    cleanupAndEnd('res.on(close)'); // Uncommented to ensure cleanup on client disconnect
  });



  try {
    // --- Check for Optional Admin Override Token using Middleware Helper ---
    const decodedToken = verifyOptionalToken(req); // Call the helper
    let overrideUserId = null;

    if (decodedToken) {
        // Token was present and valid, now check the role
        if (decodedToken.role === 'admin') {
             overrideUserId = decodedToken.userId;
             // Logging is now handled within verifyOptionalToken or here if specific to override
             ServerLoggingService.info(`Admin override activated by user ${overrideUserId}`, chatId, { requestId });
        } else {
             // Token valid but user is not an admin
             ServerLoggingService.warn(`Token validated for user ${decodedToken.userId} but role is not admin. Overrides not applied.`, chatId, { requestId });
        }
    }
    // If decodedToken is null (no token, invalid, or expired), overrideUserId remains null.
    // --- End Check ---

    const {
      userMessage,
      lang,
      referringUrl,
      selectedAI,
      selectedSearch,
      interactionId,
      user // Assuming middleware might attach user info if standard auth applied
    } = req.body;

    // Basic validation
    if (!userMessage || !chatId || !lang || !selectedAI || !selectedSearch) {
       ServerLoggingService.warn('Chat API request missing required fields', chatId, req.body);
       sendSseMessage(res, 'error', { message: 'Missing required fields in request body' });
       cleanupAndEnd('validation fail');
       return;
    }

    ServerLoggingService.debug('Chat API request received, starting processing', chatId, { requestId });

    // Remove originContext from processParams
    const processParams = {
      chatId,
      userMessage,
      lang,
      referringUrl,
      selectedAI,
      selectedSearch,
      user,
      overrideUserId,
      requestId ,
      interactionId,
    };
    // Call ChatProcessingService.processMessage without originContext
    await ChatProcessingService.processMessage(processParams);

    // If processMessage completes without throwing, the 'processing_complete' event
    // should have triggered cleanupAndEnd via handleStatusUpdate.
    ServerLoggingService.debug(`ChatProcessingService awaited successfully for request ${requestId}`, chatId);
    // We might need a final check here in case the complete event didn't fire cleanup somehow
    if (!isClosed) {
        ServerLoggingService.warn(`Handler finished but cleanup not triggered for request ${requestId}. Forcing cleanup.`, chatId);
        cleanupAndEnd('handler exit after await');
    }

  } catch (error) { // Catch synchronous errors during setup OR errors thrown by awaited processMessage
     ServerLoggingService.error('Error during chat processing in API handler:', chatId, { requestId, error: error.message, stack: error.stack });
     // Send error via SSE if possible (if stream not already closed by error event)
     if (!isClosed) {
        sendSseMessage(res, 'error', { message: 'Processing failed due to an internal error.' });
     }
     cleanupAndEnd('main try/catch'); // Clean up and end response
   }
   // The handler function now implicitly waits here until the await completes or throws.
   // Cleanup should have happened via events or the catch block.
 }

export default async function handler(req, res) {
  // Run the rate limiter first
  const allowed = await rateLimitMiddleware(req, res);
  if (!allowed) return; // rateLimitMiddleware already handled the response
  // Proceed to the main handler
  return sseMessageHandler(req, res);
}
