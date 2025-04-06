// agents/StatusEventEmitterHandler.js
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import statusEmitter from '../utils/statusEmitter.js'; // Import the shared emitter
import ServerLoggingService from '../services/ServerLoggingService.js'; // Adjust path if needed

class StatusEventEmitterHandler extends BaseCallbackHandler {
  name = 'StatusEventEmitterHandler';

  /**
   * @param {string} requestId - A unique identifier for the specific request/stream.
   */
  constructor(requestId) { 
    super();
    if (!requestId) {
      throw new Error("StatusEventEmitterHandler requires a unique requestId.");
    }
    this.requestId = requestId;
    // No need to store chatId here unless needed for specific event data
    ServerLoggingService.debug('StatusEventEmitterHandler initialized', this.requestId);
  }

  // Helper to emit events scoped to this request
  _emitEvent(eventType, data) {
    const eventName = `statusUpdate:${this.requestId}`; // Scope event by request ID
    try {
        statusEmitter.emit(eventName, { type: eventType, data });
        // Avoid logging every single emitted event here unless necessary for deep debugging,
        // as it can be very verbose. The listener side can log receipt.
        // ServerLoggingService.debug(`Emitted Event: ${eventName}`, this.requestId, { type: eventType, data });
    } catch (error) {
        ServerLoggingService.error(`Failed to emit event ${eventName}: ${error.message}`, this.requestId, error);
    }
  }

  async handleToolStart(tool, input, runId, parentRunId, tags, metadata, runName) {
    const toolName = runName || tool?.name || 'Unknown Tool';
    // Optionally sanitize/summarize input if it could be large/sensitive
    this._emitEvent('tool_start', { name: toolName /*, input: summarizedInput */ });
  }

  async handleToolError(error, runId, parentRunId, tags) {
    const errorMessage = error.message || String(error);
    // May need to correlate with handleToolStart via runId if name is needed
    this._emitEvent('tool_error', { message: `Tool execution failed: ${errorMessage}` /*, name: toolName */ });
  }

  async handleLLMStart(llm, prompts, runId, parentRunId, extraParams, tags, metadata, name) {
    // Maybe include model name if available in llm object?
    this._emitEvent('llm_start', { message: 'LLM call started.' });
  }
}

export { StatusEventEmitterHandler };
