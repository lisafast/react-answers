// Now import dependencies
import RedactionService from './RedactionService.js';
import ClientLoggingService from './ClientLoggingService.js';
import { getApiUrl } from '../utils/apiToUrl.js';

// Define constants first
export const PipelineStatus = {
  REDACTING: 'redacting',
  MODERATING_QUESTION: 'moderatingQuestion',
  SEARCHING: 'searching',
  GETTING_CONTEXT: 'gettingContext',
  // Simplified status, specific events handled by callbacks now
  PROCESSING: 'processing', // Generic processing state for stages like connecting/redacting
  COMPLETE: 'complete', // Final success state
  ERROR: 'error', // Generic error state
  // Specific agent lifecycle events from AgentStatusSseHandler
  AGENT_START: 'agent_start',
  TOOL_START: 'tool_start',
  TOOL_END: 'tool_end', // Keep for potential future use
  LLM_START: 'llm_start',
  LLM_END: 'llm_end', // Keep for potential future use
  AGENT_END: 'agent_end', // Agent finished successfully (before final_answer)
  AGENT_ERROR: 'agent_error', // Specific agent error
  TOOL_ERROR: 'tool_error', // Specific tool error
  STREAMING_CHUNK: 'streaming_chunk', // Status for receiving a text chunk (if re-enabled)
};

// Define classes that might be imported elsewhere
export class RedactionError extends Error {
  constructor(message, redactedText, redactedItems) {
    super(message);
    this.name = 'RedactionError';
    this.redactedText = redactedText;
    this.redactedItems = redactedItems;
  }
}

export class ChatService {

  static async processRedaction(userMessage) {
    await RedactionService.ensureInitialized();
    const { redactedText, redactedItems } = RedactionService.redactText(userMessage);

    const hasBlockedContent = redactedText.includes('#') || redactedText.includes('XXX');
    if (hasBlockedContent) {
      throw new RedactionError('Blocked content detected', redactedText, redactedItems);
    }
  }

  /**
   * Processes the chat request using SSE streaming.
   * @param {string} chatId
   * @param {string} userMessage
   * @param {string} lang
   * @param {string} selectedDepartment
   * @param {string} referringUrl
   * @param {string} selectedAI
   * @param {function} onStatusUpdate - Callback function for status updates.
   * @param {string} selectedSearch
   * @param {string|null} [authToken=null] - Optional auth token for admin overrides.
   * @returns {Promise<object>} A promise that resolves with the final answer data.
   */
  static processChatStream(
    chatId,
    userMessage,
    lang,
    selectedDepartment,
    referringUrl,
    selectedAI,
    onStatusUpdate = () => {},
    selectedSearch,
    authToken = null,
    interactionId
  ) {
    // Return a new Promise
    return new Promise((resolve, reject) => { // Remove async from executor
      
      // Use the single callback for status updates
      onStatusUpdate(PipelineStatus.PROCESSING, { key: 'homepage.chat.status.agent_start', params: {} });

      // Wrap async logic in an IIAFE
      (async () => {
        try {
          // Use locale key for redaction status
          onStatusUpdate(PipelineStatus.REDACTING, { key: 'homepage.chat.status.tool.redacting', params: {} });
          await this.processRedaction(userMessage);

         

        
          const headers = {
            'Content-Type': 'application/json',
          };
          if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
            ClientLoggingService.debug(chatId, 'Sending request with Authorization header for override testing.');
          }

          const response = await fetch(getApiUrl('chat'), {
            method: 'POST',
            headers: headers, // Use the constructed headers object
            body: JSON.stringify({
              chatId,
              userMessage, // Send original message after client-side redaction check
              lang,
              referringUrl,
              selectedAI,
              selectedSearch,
              interactionId,
            }),
          });

          if (!response.ok) {
            // Attempt to read error message from body
            let errorBody = 'Failed to connect to stream.';
            try {
              errorBody = await response.text();
            } catch (_) { /* Ignore read error */ }
            // Reject the promise on connection failure
            return reject(new Error(`Stream connection failed: ${response.status} ${response.statusText} - ${errorBody}`));
          }

          if (!response.body) {
            // Reject the promise if body is null
            return reject(new Error('Response body is null, cannot read stream.'));
          }

          onStatusUpdate(PipelineStatus.PROCESSING, { key: 'homepage.chat.status.llm_start', params: {} });

          // Manually read and parse the SSE stream
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let done = false;
          let finalData = null; // To store the final answer data

          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone; // Update loop condition

            if (value) { // Process the chunk if value exists
              buffer += decoder.decode(value, { stream: true });
              const eventMessages = buffer.split('\n\n');

              // Process all complete messages in the buffer
              for (let i = 0; i < eventMessages.length - 1; i++) {
                const message = eventMessages[i];
                if (message.trim()) { // Ensure message is not empty
                  // Parse message and potentially resolve/reject promise
                  const parseResult = this.parseSseMessage(message, chatId);
                  if (parseResult) {
                    const { eventType, parsedData } = parseResult;
                    // Translate SSE event to status update
                    this.handleSseEvent(eventType, parsedData, onStatusUpdate, chatId, (data) => {
                      finalData = data; // Store final data when received
                    });
                    // Check if it was a terminal event
                    if (eventType === 'final_answer' || eventType === 'error') {
                      done = true; // Force loop exit
                      break;
                    }
                  }
                }
              }
              if (done) break; // Exit outer loop if inner loop broke due to final event
              // Keep the last potentially incomplete message in the buffer
              buffer = eventMessages[eventMessages.length - 1];
            }
          }
          

          // Process any remaining data in the buffer after the stream ends
          if (buffer.trim() && !finalData) { // Only process if no final data yet
            const parseResult = this.parseSseMessage(buffer, chatId);
            if (parseResult) {
              const { eventType, parsedData } = parseResult;
              this.handleSseEvent(eventType, parsedData, onStatusUpdate, chatId, (data) => {
                finalData = data;
              });
            }
          }

          if (finalData) {
            // Use locale key for completion status
            onStatusUpdate(PipelineStatus.COMPLETE, { key: 'homepage.chat.status.tool.complete', params: {} });
            resolve(finalData); // Resolve the promise with the final answer data
          } else {
            // If stream ended but we never got a final_answer or error event through parsing
            ClientLoggingService.warn(chatId, 'Stream ended without receiving a recognized terminal event (final_answer or error).');
            // Reject or resolve with a default? Let's reject for clarity.
            reject(new Error('Stream ended unexpectedly without a final answer or error event.'));
          }

        } catch (error) {
          ClientLoggingService.error(chatId, 'Error during chat stream processing:', error);
          // Use locale key for generic error message
          onStatusUpdate(PipelineStatus.ERROR, { key: 'homepage.chat.messages.error', params: {} });
          reject(error); // Reject the promise on error
        }
      })(); // Immediately invoke the async function
    });
  }

  /**
   * Parses a raw SSE message string.
   * @param {string} rawMessage - The raw SSE message block.
   * @param {string} chatId - For logging.
   * @returns {{eventType: string, parsedData: object}|null} - Parsed event or null if invalid.
   */
  static parseSseMessage(rawMessage, chatId) {
    let eventType = 'message'; // Default SSE event type
    let eventData = '';

    const lines = rawMessage.split('\n');
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        eventData = line.substring(5).trim();
      }
      // Ignore other lines like comments (starting with ':') or id lines
    }

    if (!eventData) {
      ClientLoggingService.warn(chatId, `Received SSE message with no data for event: ${eventType}`);
      return null; // Skip if no data
    }

    try {
      const parsedData = JSON.parse(eventData);
      return { eventType, parsedData };
    } catch (parseError) {
      ClientLoggingService.error(chatId, `Failed to parse SSE data for event ${eventType}:`, { data: eventData, error: parseError });
      // Treat parse error as an error event
      return { eventType: 'error', parsedData: { message: 'Failed to parse server event data.' } };
    }
  }

  /**
   * Handles a parsed SSE event by calling the appropriate status update.
   * @param {string} eventType
   * @param {object} parsedData
   * @param {StatusUpdateCallback} onStatusUpdate
   * @param {string} chatId
   * @param {function} storeFinalData - Callback to store final answer data.
    */
  static handleSseEvent(eventType, parsedData, onStatusUpdate, chatId, storeFinalData) {
   
    let details = {}; // Object to hold { key, params }

    switch (eventType) {
     
      case 'tool_start': {
        const toolName = parsedData.name;
        if (toolName) {
          const specificKey = `homepage.chat.status.tool.${toolName}`;
          details = { key: specificKey, params: {} };
        } else {
          details = { key: 'homepage.chat.status.using_tool_unknown', params: {} };
        }
        onStatusUpdate(PipelineStatus.TOOL_START, details);
        break;
      }
      case 'tool_error': {
        const toolName = parsedData.toolName || 'unknown';
        const message = parsedData.message || 'An unknown tool error occurred.';
        details = { key: 'homepage.chat.status.tool_error', params: { toolName, message } };
        onStatusUpdate(PipelineStatus.TOOL_ERROR, details);
        break;
      }
      case 'agent_error': {
        details = { key: 'homepage.chat.messages.error', params: {} };
        onStatusUpdate(PipelineStatus.AGENT_ERROR, details);
        storeFinalData({ error: parsedData.message || 'Agent error occurred' });
        break;
      }
      case 'processing_complete': {
        const finalResponse = parsedData.finalResponse || parsedData.answer || parsedData;
        storeFinalData(finalResponse);
        break;
      }
      default: {
        ClientLoggingService.warn(chatId, `Unhandled SSE event type: ${eventType}`, parsedData);
        break;
      }
    }
  }
}
