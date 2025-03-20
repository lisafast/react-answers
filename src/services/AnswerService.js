// src/ClaudeService.js

import loadSystemPrompt from './systemPrompt.js';
import { getProviderApiUrl } from '../utils/apiToUrl.js';
import ClientLoggingService from './ClientLoggingService.js';
import AuthService from './AuthService.js';

const AnswerService = {
  prepareMessage: async (
    provider,
    message,
    conversationHistory = [],
    lang = 'en',
    context,
    evaluation = false,
    referringUrl,
    chatId
  ) => {
    await ClientLoggingService.info(chatId, `Processing message in ${lang.toUpperCase()}`);

    const SYSTEM_PROMPT = await loadSystemPrompt(lang, context);
    if (evaluation) {
      message = '<evaluation>' + message + '</evaluation>';
    }
    const finalHistory = message.includes('<evaluation>') ? [] : conversationHistory;
    const messageWithReferrer = `${message}${referringUrl.trim() ? `\n<referring-url>${referringUrl.trim()}</referring-url>` : ''}`;
    await ClientLoggingService.debug(chatId, 'Sending to ' + provider + ' API:', {
      messageWithReferrer,
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
    context,
    evaluation,
    referringUrl,
    chatId
  ) => {
    try {
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
        await ClientLoggingService.error(chatId, provider + ' API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      await ClientLoggingService.debug(chatId, provider + ' API response:', data);
      const parsedResponse = AnswerService.parseResponse(data.content);
      const mergedResponse = { ...data, ...parsedResponse };
      return mergedResponse;
    } catch (error) {
      await ClientLoggingService.error(chatId, 'Error calling ' + provider + ' API:', error);
      throw error;
    }
  },
  parseSentences: (text) => {
    const sentenceRegex = /<s-(\d+)>(.*?)<\/s-\d+>/g;
    const sentences = [];
    let match;

    while ((match = sentenceRegex.exec(text)) !== null) {
      const index = parseInt(match[1]) - 1;
      if (index >= 0 && index < 4 && match[2].trim()) {
        sentences[index] = match[2].trim();
      }
    }

    // If no sentence tags found, treat entire text as first sentence
    if (sentences.length === 0 && text.trim()) {
      sentences[0] = text.trim();
    }

    return Array(4)
      .fill('')
      .map((_, i) => sentences[i] || '');
  },
  parseResponse: (text) => {
    if (!text) {
      return { answerType: 'normal', content: '', preliminaryChecks: null, englishAnswer: null };
    }

    let answerType = 'normal';
    let content = text;
    let preliminaryChecks = null;
    let englishAnswer = null;
    let citationHead = null;
    let citationUrl = null;
    let confidenceRating = null;
    let englishQuestion = '';

    // Extract preliminary checks - this regex needs to capture multiline content
    let questionLanguage = '';
    const preliminaryMatch = /<preliminary-checks>([\s\S]*?)<\/preliminary-checks>/s.exec(text);
    if (preliminaryMatch) {
      preliminaryChecks = preliminaryMatch[1].trim();
      content = content.replace(/<preliminary-checks>[\s\S]*?<\/preliminary-checks>/s, '').trim();
      questionLanguage = /<question-language>(.*?)<\/question-language>/s
        .exec(preliminaryChecks)[1]
        .trim();
      const englishQuestionMatch = /<english-question>(.*?)<\/english-question>/s.exec(
        preliminaryChecks
      );
      englishQuestion = englishQuestionMatch ? englishQuestionMatch[1].trim() : '';
    }

    // Extract citation information before processing answers
    const citationHeadMatch = /<citation-head>(.*?)<\/citation-head>/s.exec(content);
    const citationUrlMatch = /<citation-url>(.*?)<\/citation-url>/s.exec(content);

    if (citationHeadMatch) {
      citationHead = citationHeadMatch[1].trim();
    }
    if (citationUrlMatch) {
      citationUrl = citationUrlMatch[1].trim();
    }

        // Extract English answer first
        const englishMatch = /<english-answer>([\s\S]*?)<\/english-answer>/s.exec(content);
        if (englishMatch) {
            englishAnswer = englishMatch[1].trim();
            content = englishAnswer;  // Use English answer as content for English questions
        }

        // Extract main answer if it exists
        const answerMatch = /<answer>([\s\S]*?)<\/answer>/s.exec(text);
        if (answerMatch) {
            content = answerMatch[1].trim();
        }
        content = content.replace(/<citation-head>[\s\S]*?<\/citation-head>/s, '').trim();
        content = content.replace(/<citation-url>[\s\S]*?<\/citation-url>/s, '').trim();
        content = content.replace(/<confidence>(.*?)<\/confidence>/s, '').trim();

        // Check for special tags in either english-answer or answer content
        // These can appear in any order and don't need to wrap the entire content
        const specialTags = {
            'not-gc': /<not-gc>([\s\S]*?)<\/not-gc>/,
            'pt-muni': /<pt-muni>([\s\S]*?)<\/pt-muni>/,
            'clarifying-question': /<clarifying-question>([\s\S]*?)<\/clarifying-question>/
        };

        // Check each special tag type and extract their content
        for (const [type, regex] of Object.entries(specialTags)) {
            // Check both englishAnswer and content for the tag
            const englishMatch = englishAnswer && regex.exec(englishAnswer);
            const contentMatch = content && regex.exec(content);
            
            if (englishMatch || contentMatch) {
                answerType = type;
                // Preserve the content inside the tags
                if (englishMatch) {
                    englishAnswer = englishMatch[1].trim();
                }
                if (contentMatch) {
                    content = contentMatch[1].trim();
                }
                break; // First matching tag type wins
            }
        }

        const confidenceRatingRegex = /<confidence>(.*?)<\/confidence>/s;
        const confidenceMatch = text.match(confidenceRatingRegex);

    if (confidenceMatch) {
      confidenceRating = confidenceMatch[1].trim();
    }

        const paragraphs = content.split(/\n+/).map(paragraph => paragraph.trim()).filter(paragraph => paragraph !== '');
        const sentences = AnswerService.parseSentences(content);

    return {
      answerType,
      content,
      preliminaryChecks,
      englishAnswer,
      citationHead,
      citationUrl,
      paragraphs,
      confidenceRating,
      sentences,
      questionLanguage,
      englishQuestion,
    };
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
