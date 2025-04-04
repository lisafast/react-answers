// Now import dependencies
import RedactionService from './RedactionService.js';
import ClientLoggingService from './ClientLoggingService.js';
import { getApiUrl } from '../utils/apiToUrl.js';

// Define constants first
export const PipelineStatus = {
  REDACTING: 'redacting',
  MODERATING_QUESTION: 'moderatingQuestion',
  SEARCHING: 'searching',
  GETTING_CONTEXT: 'gettingContext', // Keep if still used elsewhere, otherwise can remove
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

// Define types/callbacks next
export const StatusUpdateCallback = (status, details) => {};

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
   * @param {string} aiMessageId - Potentially used for logging/tracking
   * @param {Array<object>} messages - Conversation history
   * @param {string} lang
   * @param {string} selectedDepartment
   * @param {string} referringUrl
   * @param {string} selectedAI
   * @param {StatusUpdateCallback} onStatusUpdate - Callback function for status updates.
   * @param {string} selectedSearch
   * @returns {Promise<object>} A promise that resolves with the final answer data.
   */
  static processChatStream( // Make it return a Promise and accept only onStatusUpdate
    chatId,
    userMessage,
    aiMessageId, // Keep for logging consistency if needed
    messages,
    lang,
    selectedDepartment, // Keep params even if not directly used in fetch body for future use/logging
    referringUrl,
    selectedAI,
    onStatusUpdate = (status, details) => {}, // Default to no-op callback
    selectedSearch
  ) {
    // Return a new Promise
    return new Promise((resolve, reject) => { // Remove async from executor
      const startTime = Date.now();
      // Use the single callback for status updates
      onStatusUpdate(PipelineStatus.PROCESSING, { stage: 'starting' });

      // Wrap async logic in an IIAFE
      (async () => {
        try {
          onStatusUpdate(PipelineStatus.REDACTING, { stage: 'redacting' });
          await this.processRedaction(userMessage); // Perform redaction before sending

        await ClientLoggingService.info(chatId, 'Starting chat stream request:', {
          // Log relevant initial data
          chatId, userMessage: 'REDACTED_FOR_LOG', lang, selectedAI, selectedSearch
        });

        onStatusUpdate(PipelineStatus.PROCESSING, { stage: 'connecting' });

        const response = await fetch(getApiUrl('chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authentication headers if required
        },
        body: JSON.stringify({
          chatId,
          userMessage, // Send original message after client-side redaction check
          messages,
          lang,
          // selectedDepartment, // Include if needed by backend logic
          referringUrl,
          selectedAI,
          selectedSearch,
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

        onStatusUpdate(PipelineStatus.PROCESSING, { stage: 'streaming' });

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
        ClientLoggingService.info(chatId, 'Stream finished reading.');

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
          onStatusUpdate(PipelineStatus.COMPLETE);
          ClientLoggingService.info(chatId, 'Chat stream processing complete.', { elapsedTime: Date.now() - startTime });
          resolve(finalData); // Resolve the promise with the final answer data
        } else {
           // If stream ended but we never got a final_answer or error event through parsing
           ClientLoggingService.warn(chatId, 'Stream ended without receiving a recognized terminal event (final_answer or error).');
           // Reject or resolve with a default? Let's reject for clarity.
           reject(new Error('Stream ended unexpectedly without a final answer or error event.'));
        }

      } catch (error) {
        ClientLoggingService.error(chatId, 'Error during chat stream processing:', error);
        onStatusUpdate(PipelineStatus.ERROR, { message: error.message });
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
      ClientLoggingService.debug(chatId, `Handling SSE Event: ${eventType}`, parsedData);
      let details = {}; // Object to hold { key, params } or { message }

      switch (eventType) {
        // --- Agent Lifecycle ---
        case 'agent_start':
          details = { key: 'homepage.chat.status.agent_start', params: {} };
          onStatusUpdate(PipelineStatus.AGENT_START, details);
          break;
        case 'llm_start':
          details = { key: 'homepage.chat.status.llm_start', params: {} };
          onStatusUpdate(PipelineStatus.LLM_START, details);
          break;
        case 'agent_end':
          // No specific timed message for agent_end, handled by completion/queue clear
          onStatusUpdate(PipelineStatus.AGENT_END, {}); // Send empty details
          break;

        // --- Tool Lifecycle ---
        case 'tool_start': { // Enclose case logic in braces for block scope
          const toolName = parsedData.name;
          if (toolName) {
            // Construct specific key. Assume toolName matches the key suffix needed.
            // Potential names: verifyOutputFormat, googleContextSearch, downloadWebPage,
            // departmentScenarios, departmentLookup, checkUrl, canadaCASearch
            const specificKey = `homepage.chat.status.tool.${toolName}`;
            details = { key: specificKey, params: {} }; // No params needed for specific keys
          } else {
            // Fallback if tool name is missing (shouldn't happen ideally)
            details = { key: 'homepage.chat.status.using_tool_unknown', params: {} };
          }
          onStatusUpdate(PipelineStatus.TOOL_START, details);
          break;
        } // End case 'tool_start'
        case 'tool_end': { // Add braces for consistency, though no declarations here yet
          // No specific timed message for tool_end
          onStatusUpdate(PipelineStatus.TOOL_END, {}); // Send empty details
          break;
        } // End case 'tool_end' <-- Add missing closing brace

        // --- Final Answer / Completion ---
        case 'final_answer': // Langchain's final answer event
        case 'processing_complete': { // Enclose case logic in braces for block scope
          // Store the final data. The promise resolution handles overall completion.
          const finalResponse = parsedData.finalResponse || parsedData.answer || parsedData; // Adapt based on actual event structure
          storeFinalData(finalResponse);
          // No specific status update here; handled by promise resolution setting COMPLETE
          break;
        } // End case 'processing_complete'

        // --- Errors ---
        case 'tool_error': { // Enclose case logic in braces
          // Use a generic error key, but pass tool name if available
          details = {
            key: 'homepage.chat.status.tool_error',
            params: { toolName: parsedData.name || 'unknown', message: parsedData.message || 'Unknown tool error' }
          };
           onStatusUpdate(PipelineStatus.TOOL_ERROR, details);
           break;
        } // End case 'tool_error'
        case 'agent_error': // Langchain's chain_error maps here
        case 'chain_error': { // Enclose case logic in braces
           details = { message: `${parsedData.message || 'Agent error'}` }; // Direct message for agent errors
           onStatusUpdate(PipelineStatus.AGENT_ERROR, details);
           break;
        } // End case 'agent_error'/'chain_error'
        case 'error': // Generic SSE error event
        case 'processing_error': { // Enclose case logic in braces
            details = { message: `${parsedData.message || 'An unexpected error occurred.'}` }; // Direct message
            onStatusUpdate(PipelineStatus.ERROR, details);
            // The promise rejection should handle the overall error state
            break;
        } // End case 'error'/'processing_error'

        // --- Other Events (Ignore for timed status display) ---
        case 'llm_end':
        case 'stream': // Handle potential streaming chunks if re-enabled later
        case 'message': // Default SSE event type if 'event:' line is missing
        default: { // Enclose default case logic in braces
          // Log unhandled events for debugging if necessary
          // ClientLoggingService.debug(chatId, `Ignoring SSE Event for status display: ${eventType}`);
           break;
        } // End default case
      } // End switch
   } // End handleSseEvent
}
