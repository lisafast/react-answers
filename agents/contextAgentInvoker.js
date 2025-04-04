import { createMessageAgent } from './agentFactory.js'; // Import createMessageAgent instead
import { ToolTrackingHandler } from './ToolTrackingHandler.js';
import ServerLoggingService from '../services/ServerLoggingService.js';

/**
 * Invokes a context agent to generate answers based on search results.
 * @param {string} agentType - The type of LLM to use ('openai', 'azure', 'anthropic', etc.)
 * @param {object} request - The request object containing message and context
 * @returns {Promise<object>} The agent's response
 */
const invokeContextAgent = async (agentType, request) => {
  // Extract chatId first to ensure it's available for error logging
  const chatId = request?.chatId || 'system';
  
  try {
    // Destructure remaining fields
    const { message, systemPrompt, searchResults, searchProvider, conversationHistory = [] } = request;
    
    // Check for undefined or null fields and log an error if any are missing
    const requiredFields = { message, systemPrompt, searchResults, searchProvider };
    for (const [fieldName, fieldValue] of Object.entries(requiredFields)) {
      if (fieldValue === undefined || fieldValue === null) {
      const errorMessage = `Missing required field: ${fieldName}`;
      ServerLoggingService.error(errorMessage, chatId);
      throw new Error(errorMessage);
      }
    }

    // Call createMessageAgent with agentType, chatId, and searchProvider (as selectedSearch)
    const contextAgent = await createMessageAgent(agentType, chatId, searchProvider); // Use createMessageAgent

    // Handle case where agent creation might fail (e.g., invalid provider)
    if (!contextAgent) {
      const errorMessage = `Failed to create context agent for type ${agentType} and provider ${searchProvider}.`;
      ServerLoggingService.error(errorMessage, chatId);
      throw new Error('Context agent creation failed.');
    }

    const messages = [
      {
        role: "system",
        content: `${systemPrompt}<searchResults>${searchResults}</searchResults>`,
      }
    ];

    // Add conversation history messages before the current message
    conversationHistory.forEach(entry => {
      messages.push({
        role: "user",
        content: entry.interaction.question
      });
      messages.push({
        role: "assistant",
        content: entry.interaction.answer.content
      });
    });

    // Add the current message
    messages.push({
      role: "user",
      content: message,
    });

    try {
      const answer = await contextAgent.invoke({
        messages: messages,
      });

      if (Array.isArray(answer.messages) && answer.messages.length > 0) {
        const lastResult = answer.messages[answer.messages.length - 1];
        const lastMessage = lastResult.content;
        ServerLoggingService.info('ContextAgent Response:', chatId, {
          content: lastMessage,
          role: answer.messages[answer.messages.length - 1]?.response_metadata.role,
          usage: answer.messages[answer.messages.length - 1]?.response_metadata.usage,
        });
        
        // Find the ToolTrackingHandler in the agent's callbacks
        let toolTrackingHandler = null;
        for (const callback of contextAgent.callbacks) {
          if (callback instanceof ToolTrackingHandler) {
            toolTrackingHandler = callback;
            break;
          }
        }

        // Get tool usage summary if available
        const toolUsage = toolTrackingHandler ? toolTrackingHandler.getToolUsageSummary() : {};
        ServerLoggingService.debug('Tool usage summary:', chatId, toolUsage);

        if (toolUsage && Array.isArray(toolUsage)) {
          const contextSearchTools = toolUsage.filter(tool => tool.tool === 'contextSearch');
          if (contextSearchTools.length > 0) {
            const outputs = contextSearchTools.map(tool => tool.output).filter(output => output);
            if (outputs.length > 0) {
              request.searchResults += `, "contextSearch": ${JSON.stringify(outputs)}`;
            }
          }
        }
        
        return {
          message: lastMessage,
          inputTokens: lastResult.response_metadata.tokenUsage?.promptTokens,
          outputTokens: lastResult.response_metadata.tokenUsage?.completionTokens,
          model: lastResult.response_metadata.model_name,
          searchProvider: request.searchProvider,
          searchResults: request.searchResults,
          tools: toolUsage
        }
      } else {
        return "No messages available";
      }
    } catch (error) {
      // Format error message as expected by tests
      ServerLoggingService.error(`Error with ${agentType} agent:`, chatId, error);
      throw error;
    }
  } catch (error) {
    // Re-throw the error to maintain the expected error chain
    throw error;
  }
};

export { invokeContextAgent };
