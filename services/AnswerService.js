// src/ClaudeService.js

import loadSystemPrompt from '../prompts/systemPrompt.js';
import { getProviderApiUrl } from '../src/utils/apiToUrl.js';
import ClientLoggingService from '../src/services/ClientLoggingService.js';
import AuthService from '../src/services/AuthService.js';
import { parseResponse } from '../utils/responseParser.js'; // Use imported function

const AnswerService = {
  prepareMessage: async (
    provider,
    message,
    conversationHistory = [],
    lang = 'en',
    context = null,
    evaluation = false,
    referringUrl,
    chatId
  ) => {
    await ClientLoggingService.info(chatId, `Processing message in ${lang.toUpperCase()}`);

    // Pass null for context when loading system prompt here
    const SYSTEM_PROMPT = await loadSystemPrompt(lang, null);
    if (evaluation) {
      message = '<evaluation>' + message + '</evaluation>';
    }
    const finalHistory = message.includes('<evaluation>') ? [] : conversationHistory;
    // Add safety check for referringUrl before trimming
    const referrerString = (referringUrl && typeof referringUrl === 'string' && referringUrl.trim())
      ? `\n<referring-url>${referringUrl.trim()}</referring-url>`
      : '';
    const messageWithReferrer = `${message}${referrerString}`;
    await ClientLoggingService.debug(chatId, 'Sending to ' + provider + ' API:', {
      messageWithReferrer, // Use the safely constructed string
      conversationHistory: finalHistory,
      systemPromptLength: SYSTEM_PROMPT.length,
    });

    return {
      message: messageWithReferrer,
      conversationHistory: finalHistory,
      systemPrompt: SYSTEM_PROMPT,
      chatId: chatId,
    };
  },

  sendMessage: async (
    provider,
    message,
    conversationHistory = [],
    lang = 'en',
    context = null,
    evaluation = false,
    referringUrl,
    chatId
  ) => {
    try {
      // Call prepareMessage, passing null for the context argument
      const messagePayload = await AnswerService.prepareMessage(
        provider,
        message,
        conversationHistory,
        lang,
        context,
        evaluation,
        referringUrl,
        chatId
      );

      const response = await fetch(getProviderApiUrl(provider, 'message'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        await ClientLoggingService.error(chatId, `${provider} API error response:`, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json(); // data now contains { content: "...", context: {...}, model: "...", ... }
      await ClientLoggingService.debug(chatId, provider + ' API response:', data);

          // Parse the content part of the response
          const parsedFields = parseResponse(data.content); // Use imported function

          // Merge the full API response (data) with the parsed fields.
      // The parsed fields (like answerType, parsed content, citationUrl) will overwrite
      // any potential conflicts from the raw 'data' object if necessary,
      // while preserving fields like 'context', 'model', 'inputTokens', etc. from 'data'.
      const mergedResponse = { ...data, ...parsedFields };

      // Ensure the 'content' field specifically uses the parsed content if parseResponse modified it
      // (e.g., extracted text from within <answer> tags)
      mergedResponse.content = parsedFields.content;

      return mergedResponse;
    } catch (error) {
      await ClientLoggingService.error(chatId, `Error calling ${provider} API:`, error); // Use chatId here, not referringUrl
      throw error;
    }
  },

  sendBatchMessages: async (provider, entries, lang, batchName, chatId) => {
    try {
      await ClientLoggingService.info(
        chatId,
        `Processing batch of ${entries.length} entries in ${lang.toUpperCase()}`
      );
      const batchEntries = await Promise.all(
        entries.map(async (entry) => {
          const context = {
            topic: entry['CONTEXT.TOPIC'],
            topicUrl: entry['CONTEXT.TOPICURL'],
            department: entry['CONTEXT.DEPARTMENT'],
            departmentUrl: entry['CONTEXT.DEPARTMENTURL'],
            searchResults: entry['CONTEXT.SEARCHRESULTS'],
            searchProvider: entry['CONTEXT.SEARCHPROVIDER'],
            model: entry['CONTEXT.MODEL'],
            inputTokens: entry['CONTEXT.INPUTTOKENS'],
            outputTokens: entry['CONTEXT.OUTPUTTOKENS'],
          };
          const referringUrl = entry['REFERRINGURL'] || '';
          const messagePayload = await AnswerService.prepareMessage(
            provider,
            entry.REDACTEDQUESTION,
            [],
            lang,
            context,
            true,
            referringUrl,
            chatId
          );
          messagePayload.context = context;
          return messagePayload;
        })
      );

      const response = await fetch(getProviderApiUrl(provider, 'batch'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader()
        },
        body: JSON.stringify({
          requests: batchEntries,
          lang: lang,
          batchName: batchName,
          provider: provider,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create batch request');
      }

      return response.json();
    } catch (error) {
      await ClientLoggingService.error(chatId, 'Error in sendBatchMessages:', error);
      throw error;
    }
  },
};

export default AnswerService;
