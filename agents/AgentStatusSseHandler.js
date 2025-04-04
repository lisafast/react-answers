import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import ServerLoggingService from '../services/ServerLoggingService.js'; // Assuming path is correct

/**
 * Sends Server-Sent Events (SSE) for key agent lifecycle events.
 * Designed to provide real-time status updates to the frontend.
 */
class AgentStatusSseHandler extends BaseCallbackHandler {
  name = 'AgentStatusSseHandler';

  constructor(chatId) {
    super();
    this.chatId = chatId;
    this.res = null; // To hold the SSE response object
    this.sendSseMessage = null; // To hold the SSE sending function
    ServerLoggingService.debug('AgentStatusSseHandler initialized', this.chatId);
  }

  /**
   * Sets the SSE response object and the message sending function.
   * @param {object} res - The HTTP response object for SSE.
   * @param {function} sseSender - The function to send SSE messages.
   */
  setSseResponse(res, sseSender) {
    this.res = res;
    this.sendSseMessage = sseSender;
    ServerLoggingService.debug('SSE response object set for AgentStatusSseHandler', this.chatId);
  }

  /**
   * Safely sends an SSE message if the response object and sender function are set.
   * @param {string} eventType - The type of the SSE event.
   * @param {object} data - The data payload for the event.
   */
  _safeSendSse(eventType, data) {
    if (this.res && this.sendSseMessage) {
      try {
        this.sendSseMessage(this.res, eventType, data);
        ServerLoggingService.debug(`SSE Sent: ${eventType}`, this.chatId, data);
      } catch (sseError) {
        // Log error but don't crash the agent execution
        ServerLoggingService.error(`Failed to send SSE event ${eventType}: ${sseError.message}`, this.chatId, sseError);
      }
    } else {
      ServerLoggingService.warn(`SSE response/sender not set, cannot send event: ${eventType}`, this.chatId);
    }
  }

  async handleAgentStart(llm, prompts, runId, parentRunId, tags, metadata) {
    this._safeSendSse('agent_start', { message: 'Agent processing started.' });
  }

  async handleToolStart(tool, input, runId, parentRunId, tags, metadata, runName) {
    const toolName = runName || tool?.name || 'Unknown Tool';
    this._safeSendSse('tool_start', { name: toolName });
  }

  async handleToolEnd(output, runId, parentRunId, tags) {
    // Optional: Send tool_end if needed in the future, but not required by current UI plan
    // const toolCall = this.toolCalls.find(call => call.runId === runId); // Need to track runId to get name if needed
    // this._safeSendSse('tool_end', { name: toolCall?.tool || 'Unknown Tool' });
  }

  async handleToolError(error, runId, parentRunId, tags) {
    const errorMessage = error.message || String(error);
    // Need a way to get the tool name associated with the runId if possible
    // For now, send a generic tool error or try to extract from error context if available
    this._safeSendSse('tool_error', { message: `Tool execution failed: ${errorMessage}` /*, name: toolName */ });
  }

  async handleLLMStart(llm, prompts, runId, parentRunId, extraParams, tags, metadata, name) {
    this._safeSendSse('llm_start', { message: 'LLM call started.' });
  }

  async handleLLMEnd(output, runId, parentRunId, tags) {
     // Optional: Send llm_end if needed in the future
     // this._safeSendSse('llm_end', { message: 'LLM call finished.' });
  }

  async handleAgentError(error, runId, parentRunId, tags) {
    const errorMessage = error.message || String(error);
    this._safeSendSse('agent_error', { message: `Agent error: ${errorMessage}` });
  }

  async handleAgentEnd(outputs, runId, parentRunId, tags) {
    this._safeSendSse('agent_end', { message: 'Agent processing finished.' });
  }

  // Implement other handlers if needed (handleText, handleChainStart, etc.)
  // For now, focusing on the core events requested.
}

export { AgentStatusSseHandler };
