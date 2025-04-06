import DataStoreService from './DataStoreService.js';
import ServerLoggingService from './ServerLoggingService.js';
import { v4 as uuidv4 } from 'uuid';
import { getAgent } from '../agents/agentFactory.js'; // Import the actual agent factory function
import { StatusEventEmitterHandler } from '../agents/StatusEventEmitterHandler.js'; // Import new handler
import { ToolTrackingHandler } from '../agents/ToolTrackingHandler.js'; // Import tool tracking handler
import { parseResponse } from '../utils/responseParser.js';
import PromptBuilderService from './PromptBuilderService.js'; // ADDED new prompt builder service
import CitationVerificationService from './CitationVerificationService.js'; // Import the new service
import EmbeddingService from './EmbeddingService.js'; // Import EmbeddingService
import EvaluationService from './EvaluationService.js'; // Import EvaluationService
import PromptOverride from '../models/promptOverride.js'; // Import the PromptOverride model
/**
 * Service responsible for orchestrating the entire workflow
 * for processing a single user chat message.
 */
class ChatProcessingService {

  /**
   * Processes a single user message, orchestrating agent interaction,
   * AI response generation, post-processing, and persistence.
   *
   * @param {object} params - Object containing all necessary parameters.
   * @param {string} params.chatId - The ID of the chat session.
   * @param {string} params.userMessage - The raw user message.
   * @param {string} params.lang - The language code.
   * @param {string} params.selectedAI - The selected AI provider.
 * @param {string} params.selectedSearch - The selected search provider.
 * @param {string} [params.referringUrl] - Optional referring URL.
 * @param {string} [params.requestId] - Optional unique ID for tracking/SSE.
 * @param {object} [params.user] - Optional user context for authorization checks.
 * @param {string} [params.overrideUserId] - Optional ID of an admin user whose prompt overrides should be applied.
 * @returns {Promise<object>} The final response object to be sent to the user.
 */
   async processMessage(params) {
    // Destructure all potential parameters
    const {
        chatId, userMessage, lang, selectedAI, selectedSearch, referringUrl,
        requestId: providedRequestId, user, overrideUserId // Added overrideUserId
    } = params;

    // Step 0: Initialization
    const { requestId, startTime, statusEmitterHandler, toolTrackingHandler, callbacks } = this._initializeProcessing(providedRequestId, chatId);
    ServerLoggingService.info('Starting ChatProcessingService.processMessage', chatId, { requestId, userMessage: userMessage.substring(0, 50) + '...', lang, selectedAI, selectedSearch, referringUrl });

    try {
      // Step 1: Retrieve & Prepare History
      const agentHistory = await this._retrieveAndPrepareHistory(chatId, requestId);

      // Step 2: Preprocess Message
      const processedMessage = await this._preprocessMessage(userMessage, chatId, requestId);

      // Step 3: Build System Prompt
      const systemPrompt = await this._buildSystemPrompt(lang, referringUrl, overrideUserId, chatId, requestId);

      // Step 4: Invoke Agent Layer - Pass overrideUserId and user context
      const agentResult = await this._invokeAgentLayer({
        selectedAI, selectedSearch, chatId, requestId, lang, referringUrl,
        agentHistory, processedMessage, callbacks, user, overrideUserId, systemPrompt // Pass new params + systemPrompt
      });

      // Step 5: Process Agent Result
      const { finalAnswer, finalContext, finalQuestion } = this._processAgentResult(
        agentResult, processedMessage, selectedAI, toolTrackingHandler, chatId, requestId
      );

      // Step 6: Post-processing (e.g., Citation Verification)
      const { finalCitationUrl, confidenceRating } = await this._performPostProcessing({
        finalAnswer, lang, chatId, requestId
      });

      // Step 7: Persistence (Synchronous for ID)
      const endTime = Date.now();
      const totalResponseTime = endTime - startTime;
      const interactionData = {
        question: finalQuestion,
        answer: finalAnswer,
        context: finalContext,
        finalCitationUrl: finalCitationUrl,
        confidenceRating: confidenceRating,
        responseTime: totalResponseTime,
        chatId: chatId,
        selectedAI: selectedAI,
        searchProvider: selectedSearch,
        pageLanguage: lang,
        referringUrl: referringUrl
      };
      const originContext = { type: 'chat', id: chatId };
      const savedInteraction = await DataStoreService.persistInteraction(interactionData, originContext);
      ServerLoggingService.info('Interaction persisted successfully', chatId, { requestId, interactionId: savedInteraction._id });


      // Step 8: Format Final Response (using savedInteraction ID)
      const finalResponse = this._formatFinalResponse({
        finalAnswer, finalCitationUrl, confidenceRating, savedInteraction
      });

      // Step 9: Trigger Background Tasks (Asynchronous - Fire and Forget)
      this._runBackgroundTasks(savedInteraction, chatId, requestId)
        .catch(bgError => {
          // Log errors from the async background task initiation itself, if any
          ServerLoggingService.error('Error initiating background tasks', chatId, { requestId, interactionId: savedInteraction?._id, error: bgError.message });
        });

      // Step 10: Finalize (Logging, Events for main response)
      this._finalizeProcessing({ chatId, requestId, startTime, finalResponse, statusEmitterHandler });

      // Return the response to the user immediately
      return finalResponse;

    } catch (error) {
      ServerLoggingService.error('Error in ChatProcessingService.processMessage', chatId, { requestId, error: error.message, stack: error.stack });
      statusEmitterHandler._emitEvent('processing_error', { message: error.message || 'Unknown processing error' });
      throw error; // Rethrow after logging and emitting
    }
  }

  /**
   * Runs background tasks (embedding, evaluation) asynchronously after persistence.
   * @param {object} savedInteraction - The already persisted interaction document.
   * @param {string} chatId - The chat ID.
   * @param {string} requestId - The unique ID for tracking.
   */
  async _runBackgroundTasks(savedInteraction, chatId, requestId) {
    ServerLoggingService.debug('Starting background tasks', chatId, { requestId, interactionId: savedInteraction._id });
    try {
      // Fetch the fully populated interaction if needed by services
      // Assuming DataStoreService has a method like findInteractionById
      const populatedInteraction = await DataStoreService.findInteractionById(savedInteraction._id);

      if (!populatedInteraction) {
        ServerLoggingService.warn('Could not retrieve populated interaction for background tasks', chatId, { requestId, interactionId: savedInteraction._id });
        return; // Cannot proceed without populated interaction
      }

      // Run embedding and evaluation concurrently
      const results = await Promise.allSettled([
        EmbeddingService.createEmbedding(populatedInteraction),
        EvaluationService.evaluateInteraction(populatedInteraction, chatId)
      ]);

      // Log results of background tasks
      if (results[0].status === 'fulfilled') {
        ServerLoggingService.info('Background embedding creation completed', chatId, { requestId, interactionId: savedInteraction._id });
      } else {
        ServerLoggingService.error('Background embedding creation failed', chatId, { requestId, interactionId: savedInteraction._id, error: results[0].reason?.message || results[0].reason });
      }

      if (results[1].status === 'fulfilled') {
        ServerLoggingService.info('Background evaluation completed', chatId, { requestId, interactionId: savedInteraction._id });
      } else {
        ServerLoggingService.error('Background evaluation failed', chatId, { requestId, interactionId: savedInteraction._id, error: results[1].reason?.message || results[1].reason });
      }

    } catch (error) {
      ServerLoggingService.error('Error during background tasks execution', chatId, { requestId, interactionId: savedInteraction._id, error: error.message, stack: error.stack });
    }
    ServerLoggingService.debug('Finished background tasks execution', chatId, { requestId, interactionId: savedInteraction._id });
  }


  /**
   * Converts database interaction history into the format expected by LangChain agents.
   * @param {Array<object>} interactions - Array of populated Interaction documents.
   * @returns {Array<{role: string, content: string}>}
   */
  _convertDbHistoryToAgentMessages(interactions = []) {
    const agentMessages = [];
    if (!Array.isArray(interactions)) {
      ServerLoggingService.warn('_convertDbHistoryToAgentMessages received non-array', null, { interactions });
      return agentMessages;
    }

    for (const interaction of interactions) {
      // Ensure related documents are populated and have the necessary fields
      if (interaction.question?.redactedQuestion) {
        agentMessages.push({ role: 'user', content: interaction.question.redactedQuestion });
      }
      if (interaction.answer?.content) {
        agentMessages.push({ role: 'assistant', content: interaction.answer.content });
      }
    }
    return agentMessages;
  }

  /**
   * Initializes the processing context, setting up request ID, timers, and callbacks.
   * @param {string} providedRequestId - Optional request ID provided by the caller.
   * @param {string} chatId - The chat ID for tracking.
   * @returns {object} Contains requestId, startTime, statusEmitterHandler, toolTrackingHandler, callbacks.
   */
  _initializeProcessing(providedRequestId, chatId) {
    const requestId = providedRequestId || uuidv4();
    const startTime = Date.now();
    const statusEmitterHandler = new StatusEventEmitterHandler(requestId);
    const toolTrackingHandler = new ToolTrackingHandler(chatId);
    const callbacks = [statusEmitterHandler, toolTrackingHandler];
    ServerLoggingService.debug('Processing initialized', chatId, { requestId, startTime });
    return { requestId, startTime, statusEmitterHandler, toolTrackingHandler, callbacks };
  }

  /**
   * Retrieves chat history from the database and converts it for the agent.
   * @param {string} chatId - The ID of the chat session.
   * @param {string} requestId - The unique ID for tracking.
   * @returns {Promise<Array<{role: string, content: string}>>} The agent-formatted chat history.
   */
  async _retrieveAndPrepareHistory(chatId, requestId) {
    const chatSession = await DataStoreService.findChatById(chatId);
    const dbHistory = chatSession?.interactions || [];
    const agentHistory = this._convertDbHistoryToAgentMessages(dbHistory);
    ServerLoggingService.debug('Retrieved and converted chat history', chatId, { requestId, dbCount: dbHistory.length, agentCount: agentHistory.length });
    return agentHistory;
  }

  /**
   * Performs preprocessing on the user message (e.g., redaction, moderation).
   * Currently a placeholder.
   * @param {string} userMessage - The raw user message.
   * @param {string} chatId - The chat ID for logging.
   * @param {string} requestId - The unique ID for tracking.
   * @returns {Promise<string>} The processed user message.
   */
  async _preprocessMessage(userMessage, chatId, requestId) {
    // Placeholder for actual preprocessing logic (redaction, moderation)
    const processedMessage = userMessage;
    ServerLoggingService.debug('Message preprocessing complete (placeholder)', chatId, { requestId });
    return processedMessage;
  }

  /**
   * Invokes the LangChain agent with the prepared context and message.
   * @param {object} params - Agent invocation parameters.
   * @param {string} params.selectedAI - The selected AI provider.
   * @param {string} params.selectedSearch - The selected search provider.
   * @param {string} params.chatId - The chat ID.
   * @param {string} params.requestId - The unique ID for tracking.
   * @param {string} params.lang - The language code.
   * @param {string} [params.referringUrl] - Optional referring URL.
 * @param {Array<object>} params.agentHistory - Prepared chat history.
 * @param {string} params.processedMessage - The preprocessed user message.
 * @param {Array<object>} params.callbacks - Callbacks for the agent invocation.
 * @param {object} [params.user] - Optional user context for authorization.
 * @param {string} [params.overrideUserId] - Optional ID of admin user for prompt overrides.
 * @param {string} params.systemPrompt - The pre-built system prompt.
   * @returns {Promise<object>} The raw result from the agent invocation.
  */
  async _invokeAgentLayer({ selectedAI, selectedSearch, chatId, requestId, lang, referringUrl, agentHistory, processedMessage, callbacks, user, overrideUserId, systemPrompt }) { // Added systemPrompt

    // Retrieve overrides
    const overrides = await this._getPromptOverrides(overrideUserId, chatId, requestId);

    // Pass the overrides map to getAgent
    const agent = await getAgent(selectedAI, selectedSearch, chatId, overrides); // Pass overrides map
    if (!agent) {
      throw new Error(`Failed to create or retrieve agent for type: ${selectedAI}`);
    }
    ServerLoggingService.debug('Agent instance retrieved/created', chatId, { requestId, agentType: selectedAI, searchType: selectedSearch });

    // System prompt is now built and passed in

    const agentMessages = [
      { role: "system", content: systemPrompt }, // Use passed systemPrompt
      ...agentHistory,
      { role: "user", content: processedMessage }
    ];

    ServerLoggingService.debug('Invoking agent', chatId, { requestId, messageCount: agentMessages.length });
    const agentResult = await agent.invoke(
      { messages: agentMessages },
      { callbacks } // Pass the original callbacks
    );
    ServerLoggingService.debug('Agent layer invocation complete', chatId, { requestId });
    return agentResult;
  }

  /**
   * Retrieves active prompt overrides for a given user ID and returns them as a map.
   * @param {string} overrideUserId - The ID of the user whose overrides to fetch.
   * @param {string} chatId - The chat ID for logging.
   * @param {string} requestId - The request ID for logging.
   * @returns {Promise<object>} A map where keys are filenames and values are override content.
   */
  async _getPromptOverrides(overrideUserId, chatId, requestId) {
    const overridesMap = {};
    if (!overrideUserId) {
      return overridesMap; // Return empty map if no user ID
    }

    try {
      const overrides = await PromptOverride.find({
        userId: overrideUserId,
        isActive: true,
      }).lean(); // Use .lean() for plain JS objects

      if (overrides && overrides.length > 0) {
        ServerLoggingService.debug(`Found ${overrides.length} active overrides for user`, chatId, { requestId, overrideUserId });
        overrides.forEach(override => {
          // Use a consistent key format (e.g., relative path from prompts dir)
          // Assuming override.filename stores something like 'base/availableTools.js' or 'scenarios/context-specific/cra/cra-scenarios.js'
          overridesMap[override.filename] = override.content;
        });
      } else {
        ServerLoggingService.debug('No active overrides found for user', chatId, { requestId, overrideUserId });
      }
    } catch (error) {
      ServerLoggingService.error('Error fetching prompt overrides', chatId, { requestId, overrideUserId, error: error.message });
      // Decide if you want to throw or just return an empty map
    }
    return overridesMap;
  }


  /**
   * Builds the system prompt using the PromptBuilderService.
   * @param {string} lang - The language code.
   * @param {string} referringUrl - Optional referring URL.
   * @param {string} overrideUserId - Optional ID of admin user for prompt overrides.
   * @param {string} chatId - The chat ID.
   * @param {string} requestId - The unique ID for tracking.
   * @returns {Promise<string>} The built system prompt.
   */
  async _buildSystemPrompt(lang, referringUrl, overrideUserId, chatId, requestId) {
    // Retrieve overrides first
    const overrides = await this._getPromptOverrides(overrideUserId, chatId, requestId);

    // Pass overrides map to PromptBuilderService
    let systemPrompt = await PromptBuilderService.buildPrompt(lang, referringUrl, overrides); // Pass overrides map

    if (overrideUserId) {
      ServerLoggingService.debug('Built system prompt using overrides map.', chatId, { requestId, overrideUserId, overrideCount: Object.keys(overrides).length });
    } else {
      ServerLoggingService.debug('Building standard system prompt using PromptBuilderService.', chatId, { requestId });
    }
    return systemPrompt;
  }

  /**
   * Processes the raw result from the agent, parsing and extracting relevant information.
   * @param {object} agentResult - The raw result from the agent.
   * @param {string} processedMessage - The message sent to the agent.
   * @param {string} selectedAI - The AI model used.
   * @param {ToolTrackingHandler} toolTrackingHandler - Handler to get tool usage.
   * @param {string} chatId - The chat ID for logging.
   * @param {string} requestId - The unique ID for tracking.
   * @returns {object} Contains finalAnswer, finalContext, finalQuestion, parsedData.
   */
  _processAgentResult(agentResult, processedMessage, selectedAI, toolTrackingHandler, chatId, requestId) {
    let finalAnswer = {};
    let finalContext = {};
    let finalQuestion = processedMessage; // Default
    let lastMessage = null;
    let parsedData = {};

    // Determine the structure of the agent result
    if (Array.isArray(agentResult.messages) && agentResult.messages.length > 0) {
      lastMessage = agentResult.messages[agentResult.messages.length - 1];
    } else if (typeof agentResult.output === 'object' && agentResult.output?.content) {
      lastMessage = agentResult.output;
    } else if (agentResult.content) {
      lastMessage = agentResult;
    }

    if (lastMessage && lastMessage.content) {
      parsedData = parseResponse(lastMessage.content);

      finalAnswer.content = parsedData.content || 'No content found after parsing agent response.';
      const metadata = lastMessage.metadata || {};
      const responseMetadata = lastMessage.response_metadata || {};
      finalContext = metadata.context || {}; // Context might be separate

      // Extract fields from PARSED data
      finalAnswer.answerType = parsedData.answerType || 'unknown';
      finalAnswer.sentences = parsedData.sentences || [];
      finalAnswer.citationUrl = parsedData.citationUrl || null;
      finalAnswer.citationHead = parsedData.citationHead || null;
      finalAnswer.englishAnswer = parsedData.englishAnswer;
      finalAnswer.questionLanguage = parsedData.questionLanguage;
      finalAnswer.englishQuestion = parsedData.englishQuestion;
      finalAnswer.confidenceRating = parsedData.confidenceRating;

      // Update finalQuestion if available in parsed data or metadata
      finalQuestion = parsedData.englishQuestion || metadata.question || finalQuestion;

      // Extract model/token info from ORIGINAL response metadata
      finalAnswer.model = responseMetadata.model_name || metadata.model || selectedAI;
      finalAnswer.inputTokens = responseMetadata.tokenUsage?.promptTokens || metadata.inputTokens || responseMetadata.usage?.prompt_tokens || responseMetadata.usage?.input_tokens;
      finalAnswer.outputTokens = responseMetadata.tokenUsage?.completionTokens || metadata.outputTokens || responseMetadata.usage?.completion_tokens || responseMetadata.usage?.output_tokens;

    } else {
      ServerLoggingService.warn('Unexpected agent result structure or missing content', chatId, { requestId, agentResult });
      finalAnswer = { content: 'Agent returned unexpected result structure or missing content.', answerType: 'error' };
      parsedData = { answerType: 'error', content: finalAnswer.content };
    }

    // Get tool usage
    const finalToolUsage = toolTrackingHandler.getToolUsageSummary();
    finalAnswer.tools = finalToolUsage;

    // Basic validation
    if (!finalAnswer || !finalAnswer.content || !finalContext) {
      ServerLoggingService.error('Failed to extract valid answer content or context after parsing', chatId, { requestId, finalAnswer, finalContext, parsedData });
      throw new Error('Failed to extract valid answer content or context after parsing agent result.');
    }

    ServerLoggingService.debug('Processed agent result', chatId, { requestId, finalAnswer: { type: finalAnswer.answerType, len: finalAnswer.content?.length, model: finalAnswer.model }, contextKeys: Object.keys(finalContext), toolCount: finalAnswer.tools?.length });

    return { finalAnswer, finalContext, finalQuestion, parsedData };
  }

  /**
   * Performs post-processing steps like citation verification.
   * @param {object} params - Post-processing parameters.
   * @param {object} params.finalAnswer - The processed answer object.
   * @param {string} params.lang - The language code.
   * @param {string} params.chatId - The chat ID.
   * @param {string} params.requestId - The unique ID for tracking.
   * @returns {Promise<{finalCitationUrl: string|null, confidenceRating: number|null}>} Verified citation URL and confidence rating.
   */
  async _performPostProcessing({ finalAnswer, lang, chatId, requestId }) {
    let finalCitationUrl = finalAnswer?.citationUrl; // Use URL from parsed data
    let confidenceRating = finalAnswer?.confidenceRating; // Use rating from parsed data

    if (finalAnswer?.citationUrl) {
      ServerLoggingService.debug('Performing citation verification', chatId, { requestId, url: finalAnswer.citationUrl });
      const citationResult = await CitationVerificationService.verifyCitation(
        finalAnswer.citationUrl,
        lang,
        chatId
      );
      finalCitationUrl = citationResult.finalCitationUrl;
      confidenceRating = citationResult.confidenceRating;
      ServerLoggingService.debug('Citation verification complete', chatId, { requestId, finalCitationUrl, confidenceRating });
    } else {
      ServerLoggingService.debug('No citation URL provided by agent, skipping verification', chatId, { requestId });
      finalCitationUrl = null; // Ensure it's null if none provided
    }
    return { finalCitationUrl, confidenceRating };
  }

  /**
   * Persists the interaction details to the database.
   * @param {object} params - Persistence parameters.
   * @param {string} params.finalQuestion - The question asked.
   * @param {object} params.finalAnswer - The final answer object.
   * @param {object} params.finalContext - The context used.
   * @param {string|null} params.finalCitationUrl - The verified citation URL.
   * @param {number|null} params.confidenceRating - The final confidence rating.
   * @param {number} params.responseTime - Total processing time.
   * @param {string} params.chatId - The chat ID.
   * @param {string} params.selectedAI - The AI model used.
   * @param {string} params.selectedSearch - The search provider used.
   * @param {string} params.lang - The language code.
   * @param {string} [params.referringUrl] - Optional referring URL.
   * @param {string} params.requestId - The unique ID for tracking.
   * @returns {Promise<object>} The saved interaction document.
   */
  async _persistInteractionData({ finalQuestion, finalAnswer, finalContext, finalCitationUrl, confidenceRating, responseTime, chatId, selectedAI, selectedSearch, lang, referringUrl, requestId }) {
    const interactionData = {
      question: finalQuestion,
      answer: finalAnswer,
      context: finalContext,
      finalCitationUrl: finalCitationUrl,
      confidenceRating: confidenceRating,
      responseTime: responseTime,
      chatId: chatId,
      selectedAI: selectedAI,
      searchProvider: selectedSearch,
      pageLanguage: lang,
      referringUrl: referringUrl
    };

    const originContext = { type: 'chat', id: chatId };
    const savedInteraction = await DataStoreService.persistInteraction(interactionData, originContext);
    ServerLoggingService.info('Interaction persisted successfully', chatId, { requestId, interactionId: savedInteraction._id });
    return savedInteraction; // Return the saved interaction
  }

  /**
   * Formats the final response object to be sent to the frontend.
   * @param {object} params - Formatting parameters.
   * @param {object} params.finalAnswer - The final answer object.
   * @param {string|null} params.finalCitationUrl - The verified citation URL.
   * @param {number|null} params.confidenceRating - The final confidence rating.
   * @param {object} params.savedInteraction - The persisted interaction document.
   * @returns {object} The response object for the frontend.
   */
  _formatFinalResponse({ finalAnswer, finalCitationUrl, confidenceRating, savedInteraction }) {
    return {
      answer: finalAnswer.content,
      answerType: finalAnswer.answerType,
      sentences: finalAnswer.sentences,
      citationUrl: finalCitationUrl, // Verified URL
      confidenceRating: confidenceRating,
      interactionId: savedInteraction._id.toString(),
      // Add any other fields the frontend needs
    };
  }

  /**
   * Finalizes the processing, logging completion and emitting events.
   * @param {object} params - Finalization parameters.
   * @param {string} params.chatId - The chat ID.
   * @param {string} params.requestId - The unique ID for tracking.
   * @param {number} params.startTime - The start time of processing.
   * @param {object} params.finalResponse - The response sent to the frontend.
   * @param {StatusEventEmitterHandler} params.statusEmitterHandler - Handler to emit events.
   */
  _finalizeProcessing({ chatId, requestId, startTime, finalResponse, statusEmitterHandler }) {
    const endTime = Date.now();
    const totalResponseTime = endTime - startTime;
    ServerLoggingService.info('Finished ChatProcessingService.processMessage', chatId, { requestId, totalResponseTime });
    statusEmitterHandler._emitEvent('processing_complete', { finalResponse });
  }

}

// Export a singleton instance
export default new ChatProcessingService();
