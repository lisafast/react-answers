import DataStoreService from '../src/services/DataStoreService.js';
// import { urlToSearch } from '../src/utils/urlToSearch.js'; // No longer needed here
import RedactionService from '../src/services/RedactionService.js';
import LoggingService from '../src/services/ClientLoggingService.js';

export const PipelineStatus = {
  REDACTING: 'redacting',
  MODERATING_QUESTION: 'moderatingQuestion',
  SEARCHING: 'searching',
  GETTING_CONTEXT: 'gettingContext',
  GENERATING_ANSWER: 'generatingAnswer',
  COMPLETE: 'complete',
  VERIFYING_CITATION: 'verifyingCitation',
  UPDATING_DATASTORE: 'updatingDatastore',
  MODERATING_ANSWER: 'moderatingAnswer',
  ERROR: 'error',
  NEED_CLARIFICATION: 'needClarification',
};
export const ChatPipelineService = {
  processResponse: async (
    chatId,
    userMessage,
    userMessageId,
    conversationHistory,
    lang,
    department,
    referringUrl,
    selectedAI,
    translationF,
    onStatusUpdate,
    searchProvider
  ) => {
    const startTime = Date.now();
    onStatusUpdate(PipelineStatus.MODERATING_QUESTION);

    onStatusUpdate(PipelineStatus.REDACTING);
    await ChatPipelineService.processRedaction(userMessage);
    await LoggingService.info(chatId, 'Starting pipeline with data:', {
      userMessage,
      lang,
      department,
      referringUrl,
      selectedAI,
    });

    

    // Clean conversation history (this part can remain)
    conversationHistory = conversationHistory.filter((message) => !message.error);
    conversationHistory = conversationHistory.filter((message) => message.sender === 'ai');

    onStatusUpdate(PipelineStatus.GENERATING_ANSWER);

    
    const combinedResponse = await AnswerService.sendMessage(
      selectedAI,
      userMessage,
      conversationHistory,
      lang,
      null, // Pass null for context; backend/agent derives it.
      false, // eval flag
      referringUrl,
      chatId
    );

    // Extract the actual answer details and the context from the combined response
    const answer = combinedResponse; // The combined object contains all fields
    const context = combinedResponse.context; // Extract the nested context object

    await LoggingService.info(chatId, 'Combined Response Received from AnswerService:', { answer: { content: answer.content, answerType: answer.answerType }, context }); // Log selectively
    // Citation verification is now handled in ChatProcessingService
    // We still need the variables, but they will be populated directly from the answer object
    // which should now contain the verified URL and confidence from the backend.
    let finalCitationUrl = answer.citationUrl; // Assuming ChatProcessingService puts the final URL here
    let confidenceRating = answer.confidenceRating; // Assuming ChatProcessingService puts the final rating here

    // Log the values received from the backend
    await LoggingService.info(chatId, 'Citation details from backend:', {
      finalCitationUrl,
      confidenceRating,
    });


    if (answer.answerType === 'question') {
      onStatusUpdate(PipelineStatus.NEED_CLARIFICATION);
    }
    // Remove VERIFYING_CITATION status update if no longer relevant here

    onStatusUpdate(PipelineStatus.UPDATING_DATASTORE);

    const endTime = Date.now();
    const totalResponseTime = endTime - startTime;
    await LoggingService.info(chatId, 'Total response time:', {
      totalResponseTime: `${totalResponseTime} ms`,
    });

    
    DataStoreService.persistInteraction({
      selectedAI: selectedAI,
      question: userMessage,
      userMessageId: userMessageId,
      referringUrl:referringUrl,
      answer: answer,
      finalCitationUrl: finalCitationUrl,
      confidenceRating: confidenceRating,
      context: context,
      chatId: chatId,
      pageLanguage: lang,
      responseTime: totalResponseTime,
      searchProvider: searchProvider
    });

    onStatusUpdate(PipelineStatus.COMPLETE);
    await LoggingService.info(chatId, 'pipeline complete');
    // Return the extracted answer and context
    return {
      answer: answer, // The full combined object acts as the 'answer' structure now
      context: context, // The context object extracted from the combined response
      question: userMessage,
      citationUrl: finalCitationUrl, // Pass the potentially verified URL
      confidenceRating: confidenceRating, // Pass the potentially updated confidence
    };
  },
  // verifyCitation method removed as it's now handled by CitationVerificationService
  processRedaction: async (userMessage) => {
    // Ensure RedactionService is initialized before using it
    await RedactionService.ensureInitialized();

    const { redactedText, redactedItems } = RedactionService.redactText(userMessage);

    // Check for blocked content (# for profanity/threats/manipulation, XXX for private info)
    const hasBlockedContent = redactedText.includes('#') || redactedText.includes('XXX');
    if (hasBlockedContent) {
      throw new RedactionError('Blocked content detected', redactedText, redactedItems);
    }
  },
};

export class RedactionError extends Error {
  constructor(message, redactedText, redactedItems) {
    super(message);
    this.name = 'RedactionError';
    this.redactedText = redactedText;
    this.redactedItems = redactedItems;
  }
}
