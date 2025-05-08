import { ConsoleCallbackHandler } from '@langchain/core/tracers/console';
import ServerLoggingService from '../services/ServerLoggingService.js';

/**
 * Custom callback handler to track tool usage in LangChain agents
 * Records tools used, their parameters, outputs, and any errors
 */
class ToolTrackingHandler extends ConsoleCallbackHandler {
    constructor(chatId) {
        super();
        this.toolCalls = [];
        this.chatId = chatId;
    }

    async handleToolStart(tool, input, runId, parentRunId, tags, metadata, runName) {
        try {
            await super.handleToolStart(tool, input);
            const toolName = runName || tool.name || tool.bound?.name || "Unknown Tool";
            this.toolCalls.push({
                runId, // Store runId for matching with completion
                tool: toolName,
                input: input,
                startTime: Date.now(),
                status: 'started',
                error: 'none'
            });
            ServerLoggingService.info(`Tool execution started: ${toolName}`, this.chatId, { input });
        } catch (error) {
            ServerLoggingService.error(`Error in handleToolStart: ${error.message}`, this.chatId, error);
            // Don't throw, just log the error
        }
    }

    async handleToolEnd(output, runId) {
        try {
            await super.handleToolEnd(output, runId);
            // Find the tool call with matching runId instead of assuming last one
            const toolCall = this.toolCalls.find(call => call.runId === runId);
            if (toolCall) {
                toolCall.output = output.content;
                toolCall.endTime = Date.now();
                toolCall.duration = toolCall.endTime - toolCall.startTime;
                toolCall.status = 'completed';
                ServerLoggingService.info(`Tool execution completed: ${toolCall.tool}`, this.chatId, {
                    duration: toolCall.duration,
                    output: typeof output === 'object' ? JSON.stringify(output) : output
                });
            } else {
                ServerLoggingService.warn(`No matching tool call found for runId: ${runId}`, this.chatId);
            }
        } catch (error) {
            ServerLoggingService.error(`Error in handleToolEnd: ${error.message}`, this.chatId, error);
            // Don't throw, just log the error
        }
    }

    async handleToolError(error, runId) {
        try {
            await super.handleToolError(error, runId);
            // Find the tool call with matching runId instead of assuming last one
            const toolCall = this.toolCalls.find(call => call.runId === runId);
            if (toolCall) {
                const errorMessage = error.message || String(error);
                toolCall.error = errorMessage;
                toolCall.endTime = Date.now();
                toolCall.duration = toolCall.endTime - toolCall.startTime;
                toolCall.status = 'error';
                ServerLoggingService.error(`Tool execution failed: ${toolCall.tool}`, this.chatId, errorMessage);
            } else {
                ServerLoggingService.warn(`No matching tool call found for runId: ${runId}`, this.chatId);
            }
        } catch (handlerError) {
            ServerLoggingService.error(`Error in handleToolError: ${handlerError.message}`, this.chatId, handlerError);
            // Don't throw, just log the error
        }
    }

    getToolUsageSummary() {
        return this.toolCalls.map(({ startTime, endTime, runId, ...call }) => ({
            ...call,
            // Clean up output/error for summary to avoid circular references
            output: call.output ? String(call.output).substring(0, 500) : undefined,
            error: call.error ? String(call.error).substring(0, 500) : undefined
        }));
    }
}

export { ToolTrackingHandler };