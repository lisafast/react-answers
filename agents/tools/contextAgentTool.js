import { tool } from "@langchain/core/tools";
import { invokeContextAgent } from "../../services/ContextAgentService.js";
import loadContextSystemPrompt from "../../src/services/contextSystemPrompt.js";

/**
 * Factory to create a context agent tool for a specific provider.
 * The tool accepts a question and corresponding search results
 * and returns the generated context string.
 */
const createContextAgentTool = (agentType = 'openai') =>
  tool(
    async ({ question, searchResults, lang = 'en', chatId = 'system' }) => {
      const systemPrompt = await loadContextSystemPrompt(lang);
      const context = await invokeContextAgent(agentType, {
        chatId,
        message: question,
        systemPrompt,
        searchResults: { results: searchResults },
        conversationHistory: [],
        searchProvider: 'tool',
      });
      return context.message;
    },
    {
      name: 'generateContext',
      description:
        'Generate contextual information for a question. Requires searchResults and the question text.',
      schema: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'User question to analyse' },
          searchResults: { type: 'string', description: 'Search results string' },
          lang: { type: 'string', description: 'Language of the question' },
        },
        required: ['question', 'searchResults'],
      },
    }
  );

export default createContextAgentTool;
