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

  // --- Implement specific handlers to emit events ---

  async handleAgentAction(action, runId, parentRunId, tags) {
    // Emitting agent action might be too verbose, focus on key events first
  }

  async handleToolStart(tool, input, runId, parentRunId, tags, metadata, runName) {
    const toolName = runName || tool?.name || 'Unknown Tool';
    // Optionally sanitize/summarize input if it could be large/sensitive
    this._emitEvent('tool_start', { name: toolName /*, input: summarizedInput */ });
  }

  async handleToolEnd(output, runId, parentRunId, tags) {
    // Optionally sanitize/summarize output
    // May need to correlate with handleToolStart via runId if name is needed
     this._emitEvent('tool_end', { /* name: toolName, output: summarizedOutput */ });
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

   async handleLLMEnd(output, runId, parentRunId, tags) {
     // Could emit token usage if available in output.llmOutput
     this._emitEvent('llm_end', { message: 'LLM call finished.' });
   }

  async handleChainStart(chain, inputs, runId, parentRunId, tags, metadata, runType, name) {
     // Useful for tracking entry into specific chains/agents
     this._emitEvent('chain_start', { name: name || runType });
  }

   async handleChainEnd(outputs, runId, parentRunId, tags, runType, name) {
     this._emitEvent('chain_end', { name: name || runType });
   }

   async handleChainError(error, runId, parentRunId, tags, runType, name) {
     const errorMessage = error.message || String(error);
     this._emitEvent('chain_error', { name: name || runType, message: errorMessage });
   }

  // Agent Start/End might be less useful if Chain Start/End is used for the main agent
  // async handleAgentStart(...) { this._emitEvent('agent_start', ...); }
  // async handleAgentEnd(...) { this._emitEvent('agent_end', ...); }

  async handleText(text, runId, parentRunId, tags) {
     // This can be VERY verbose if the LLM streams tokens.
     // Only enable if fine-grained token streaming to the client is essential.
     // this._emitEvent('llm_token', { token: text });
  }

  // Add other handlers as needed
}

export { StatusEventEmitterHandler };
