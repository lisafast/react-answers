// api/openai/openai-message.js
import { createMessageAgent } from '../../agents/agentFactory.js'; // Updated import
import ServerLoggingService from '../../services/ServerLoggingService.js';
import { ToolTrackingHandler } from '../../agents/ToolTrackingHandler.js';

const NUM_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second

const convertInteractionsToMessages = (interactions) => {
  let messages = [];
  // Reverse the interactions array to process them in reverse order.
  const reversedInteractions = [...interactions].reverse();
  for (let i = reversedInteractions.length - 1; i >= 0; i--) {
    messages.push({
      role: "user",
      content: reversedInteractions[i].interaction.question,
    });

    messages.push({
      role: "assistant",
      content: reversedInteractions[i].interaction.answer.content,
    });
  }
  return messages;
};

async function invokeHandler(req, res) {
  if (req.method === 'POST') {
    try {

    
      console.log('OpenAI API request received');
      const { message, systemPrompt, conversationHistory, chatId } = req.body;
      console.log('Request body:', req.body);

      // Use the new generic message agent creator
      const openAIAgent = await createMessageAgent('openai', chatId);

      // Handle potential agent creation failure
      if (!openAIAgent) {
          throw new Error('Failed to create OpenAI message agent.');
      }

      const messages = [
        {
          role: "system",
          content: systemPrompt,
        },
        ...convertInteractionsToMessages(conversationHistory),
        {
          role: "user",
          content: message,
        },
      ];

      let answer = await openAIAgent.invoke({
        messages: messages,
      });

      if (Array.isArray(answer.messages) && answer.messages.length > 0) {
        
        const lastMessage = answer.messages[answer.messages.length - 1];

        // Extract context from agent response metadata (adjust path if agent structure differs)
        const agentContext = lastMessage.metadata?.context || {};
        ServerLoggingService.debug('Extracted context from agent metadata:', chatId, agentContext);

        // Find the correct tool tracking handler from callbacks
        let toolTrackingHandler = null;
        for (const callback of openAIAgent.callbacks) {
          if (callback instanceof ToolTrackingHandler) {
            toolTrackingHandler = callback;
            break;
          }
        }

        const toolUsage = toolTrackingHandler ? toolTrackingHandler.getToolUsageSummary() : {};
        ServerLoggingService.info('Tool usage summary:', chatId, toolUsage);

        const response = {
          content: lastMessage.content,
          inputTokens: lastMessage.response_metadata?.tokenUsage?.promptTokens, // Add safe navigation
          outputTokens: lastMessage.response_metadata?.tokenUsage?.completionTokens, // Add safe navigation
          model: lastMessage.response_metadata?.model_name, // Add safe navigation
          tools: toolUsage, // Include tool usage data in the response
          context: agentContext // Include the extracted context object
        };
        ServerLoggingService.info('OpenAI API request completed successfully', chatId, { content: response.content, model: response.model, contextTopic: response.context?.topic }); // Log selectively
        res.json(response);
      } else {
        throw new Error('OpenAI returned no messages');
      }
    } catch (error) {
      const chatId = req.body?.chatId || 'system';
      ServerLoggingService.error('Error processing OpenAI message:', chatId, error); // More specific error message
      res.status(500).json({ message: 'Error processing OpenAI message', error: error.message }); // Match test structure
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

export default async function handler(req, res) {
  let lastError;

  for (let attempt = 0; attempt < NUM_RETRIES; attempt++) {
    try {
      return await invokeHandler(req, res);
    } catch (error) {
      lastError = error;
      ServerLoggingService.error(`Attempt ${attempt + 1} failed:`, req.body?.chatId || 'system', error);

      if (attempt < NUM_RETRIES - 1) {
        const delay = Math.pow(2, attempt) * BASE_DELAY;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  ServerLoggingService.error('All retry attempts failed', req.body?.chatId || 'system', lastError);
  return res.status(500).json({
    error: 'Failed after retries',
    details: lastError?.message
  });
}
