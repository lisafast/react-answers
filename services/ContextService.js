// src/ContextService.js
// import loadContextSystemPrompt from '../services/contextSystemPrompt.js'; // REMOVED - Context prompt logic is now part of the main agent prompt
import { getProviderApiUrl, getApiUrl } from '../src/utils/apiToUrl.js';
import LoggingService from '../src/services/ClientLoggingService.js';
import AuthService from '../src/services/AuthService.js';

const ContextService = {
  prepareMessage: async (
    message,
    lang = 'en',
    department = '',
    referringUrl = '',
    searchResults = null,
    searchProvider = null,
    conversationHistory = [],
    chatId = 'system'
  ) => {
    await LoggingService.info(
      chatId,
      `Context Service: Processing message in ${lang.toUpperCase()}`
    );

    const messageWithReferrer = `${message}${referringUrl ? `\n<referring-url>${referringUrl}</referring-url>` : ''}`;

    return {
      message: messageWithReferrer,
      searchResults,
      searchProvider,
      conversationHistory,
      referringUrl,
      chatId,
    };
  },

  sendMessage: async (
    aiProvider,
    message,
    lang = 'en',
    department = '',
    referringUrl,
    searchResults,
    searchProvider,
    conversationHistory = [],
    chatId = 'system'
  ) => {
    try {
      const messagePayload = await ContextService.prepareMessage(
        message,
        lang,
        department,
        referringUrl,
        searchResults,
        searchProvider,
        conversationHistory,
        chatId
      );
      let url = getProviderApiUrl(aiProvider, 'context');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        await LoggingService.error(chatId, 'Context API error response:', { errorText });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      await LoggingService.error(chatId, 'Error calling Context API:', error);
      throw error;
    }
  },

  contextSearch: async (message, searchProvider, lang = 'en', chatId = 'system') => {
    try {
      const searchResponse = await fetch(getApiUrl('search-context'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: message,
          lang: lang,
          searchService: searchProvider,
          chatId,
        }),
      });

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        await LoggingService.error(chatId, 'Search API error response:', { errorText });
        throw new Error(`HTTP error! status: ${searchResponse.status}`);
      }

      return await searchResponse.json();
    } catch (error) {
      await LoggingService.error(chatId, 'Error searching context:', error);
      throw error;
    }
  },
  // Removed deriveContext as it's now handled by the agent/ContextTool on the backend
  // deriveContext: async (...) => { ... },
  parseContext: (context) => {
    // This might still be used by the ContextTool or contextAgentInvoker, keep for now.
    // Ensure the input 'context' object structure matches what the backend API/agent provides.
    // It might need adjustment if the structure returned by the backend differs from the old sendMessage output.
    // Assuming 'context.message' is no longer the primary source, but rather direct fields.
    // Let's adjust based on the expected structure from the backend/agent response:
    // { content: "...", context: { topic: "...", topicUrl: "...", ... }, model: "..." }
    // The 'context' object passed here should be the nested 'context' object.

    // If context.message exists (old structure), parse it. Otherwise, use direct fields.
    const topicMatch = context.message?.match(/<topic>([\s\S]*?)<\/topic>/);
    const topicUrlMatch = context.message?.match(/<topicUrl>([\s\S]*?)<\/topicUrl>/);
    const departmentMatch = context.message?.match(/<department>([\s\S]*?)<\/department>/);
    const departmentUrlMatch = context.message?.match(/<departmentUrl>([\s\S]*?)<\/departmentUrl>/);

    return {
      // Prefer direct fields if they exist, fall back to parsing message
      topic: context.topic ?? (topicMatch ? topicMatch[1] : null),
      topicUrl: context.topicUrl ?? (topicUrlMatch ? topicUrlMatch[1] : null),
      department: context.department ?? (departmentMatch ? departmentMatch[1] : null),
      departmentUrl: context.departmentUrl ?? (departmentUrlMatch ? departmentUrlMatch[1] : null),
      searchResults: context.searchResults, // Assuming these are passed directly
      searchProvider: context.searchProvider, // Assuming these are passed directly
      model: context.model, // Assuming these are passed directly
      inputTokens: context.inputTokens,
      outputTokens: context.outputTokens,
      tools: context.tools, // Add the tools field here
    };
  },

  deriveContextBatch: async (
    entries,
    lang = 'en',
    aiService = 'anthropic',
    batchName,
    searchProvider = 'google',
    chatId = 'batch'
  ) => {
    try {
      await LoggingService.info(
        chatId,
        `Context Service: Processing batch of ${entries.length} entries in ${lang.toUpperCase()}`
      );

      const searchResults = [];
      for (let i = 0; i < entries.length; i++) {
        if (searchProvider === 'canadaca') {
          await LoggingService.info(
            chatId,
            'Pausing for 10 seconds to avoid rate limits for canadaca...'
          );
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
        searchResults.push(
          await ContextService.contextSearch(
            entries[i]['REDACTEDQUESTION'],
            searchProvider,
            lang,
            chatId
          )
        );
      }

      const requests = await Promise.all(
        entries.map(async (entry, index) => {
          return ContextService.prepareMessage(
            entry['REDACTEDQUESTION'],
            lang,
            '', // department not provided in batch
            entry['REFERRINGURL'] || '',
            searchResults[index],
            searchProvider,
            [],
            chatId
          );
        })
      );

      const response = await ContextService.sendBatch(requests, aiService, batchName, lang);
      return {
        batchId: response.batchId,
        batchStatus: response.batchStatus,
      };
    } catch (error) {
      await LoggingService.error(chatId, 'Error deriving context batch:', error);
      throw error;
    }
  },

  sendBatch: async (requests, aiService, batchName, lang) => {
    try {
      await LoggingService.info('batch', `Context Service: Sending batch to ${aiService}`);
      const response = await fetch(getProviderApiUrl(aiService, 'batch-context'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader()
        },
        body: JSON.stringify({
          requests,
          aiService,
          batchName,
          lang,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        await LoggingService.error('batch', 'Context API batch error response:', { errorText });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      await LoggingService.error('batch', 'Error calling Context API batch:', error);
      throw error;
    }
  },
};

export default ContextService;
