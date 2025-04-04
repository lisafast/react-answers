import mongoose from 'mongoose';
import dbConnect from '../api/db/db-connect.js'; // Assuming db-connect handles connection logic
import { Chat } from '../models/chat.js';
import { Interaction } from '../models/interaction.js';
import { Context } from '../models/context.js';
import { Question } from '../models/question.js';
import { Citation } from '../models/citation.js';
import { Answer } from '../models/answer.js';
import { Tool } from '../models/tool.js';
import { Batch } from '../models/batch.js'; // Assuming Batch model exists or will be BatchRun
// Import other models as needed (User, Eval, ExpertFeedback etc.)

/**
 * Service responsible for all direct interactions with the MongoDB database.
 */
class DataStoreService {

  /**
   * Ensures database connection is established.
   */
  async ensureDbConnection() {
    // Re-implement or reuse connection logic (e.g., from db-connect.js)
    await dbConnect();
  }

  /**
   * Persists a complete interaction, including related documents,
   * and links it to the appropriate parent (Chat or Batch).
   *
   * @param {object} interactionData - The structured data for the interaction,
   *                                   containing details for Answer, Question, Context etc.
   * @param {object} originContext - Object indicating the source:
   *                                 { type: 'chat' | 'batch', id: string }
   * @returns {Promise<Interaction>} The saved Interaction document.
   */
  async persistInteraction(interactionData, originContext) {
    await this.ensureDbConnection();

    // Renamed interactionData to interaction for consistency with original logic
    const interaction = interactionData; 
    const { type: originType, id: originId } = originContext;

    // Create all MongoDB document objects without saving them yet
    const dbInteraction = new Interaction();
    dbInteraction.interactionId = interaction.userMessageId; // Assuming userMessageId maps to interactionId
    dbInteraction.responseTime = interaction.responseTime;
    dbInteraction.referringUrl = interaction.referringUrl;

    const context = new Context();
    // Explicitly assign fields from interaction.context based on Context schema
    context.topic = interaction.context?.topic;
    context.topicUrl = interaction.context?.topicUrl;
    context.department = interaction.context?.department;
    context.departmentUrl = interaction.context?.departmentUrl;
    context.searchResults = interaction.context?.searchResults;
    context.inputTokens = interaction.context?.inputTokens;
    context.outputTokens = interaction.context?.outputTokens;
    context.model = interaction.context?.model;
    context.searchProvider = interaction.context?.searchProvider;
    // Note: context.tools are handled later
    dbInteraction.context = context._id;

    const citation = new Citation();
    // Use optional chaining for safety
    citation.aiCitationUrl = interaction.answer?.citationUrl;
    citation.providedCitationUrl = interaction.finalCitationUrl; // Provided separately in interactionData
    citation.confidenceRating = interaction.confidenceRating; // Provided separately in interactionData
    citation.citationHead = interaction.answer?.citationHead;

    const answer = new Answer();
    answer.citation = citation._id;
    // Explicitly assign fields from interaction.answer based on Answer schema
    answer.englishAnswer = interaction.answer?.englishAnswer;
    answer.content = interaction.answer?.content; // Parsed content
    answer.inputTokens = interaction.answer?.inputTokens;
    answer.outputTokens = interaction.answer?.outputTokens;
    answer.model = interaction.answer?.model;
    answer.answerType = interaction.answer?.answerType;
    // Ensure sentences array is correctly assigned
    answer.sentences = Array.isArray(interaction.answer?.sentences) ? interaction.answer.sentences : [];
    // Note: answer.tools and answer.citation are handled separately

    const question = new Question();
    question.redactedQuestion = interaction.question; // Provided separately in interactionData
    question.language = interaction.answer?.questionLanguage;
    question.englishQuestion = interaction.answer?.englishQuestion;

    // Handle tools data with proper validation for answer
    const answerToolsData = Array.isArray(interaction.answer?.tools) ? interaction.answer.tools : [];
    const answerToolObjects = answerToolsData.map(toolData => new Tool({
      tool: toolData.tool,
      input: toolData.input,
      // output: toolData.output, // Add if needed
      startTime: toolData.startTime,
      endTime: toolData.endTime,
      duration: toolData.duration,
      status: toolData.status || 'completed',
      error: toolData.error
    }));

    // Handle tools data for context if available
    const contextToolsData = Array.isArray(interaction.context?.tools) ? interaction.context.tools : [];
    const contextToolObjects = [];
    for (const toolData of contextToolsData) {
        if (typeof toolData === 'object' && toolData !== null && typeof toolData.tool === 'string') {
            contextToolObjects.push(new Tool({
                tool: toolData.tool,
                input: toolData.input,
                output: toolData.output,
                duration: toolData.duration || 0,
                status: toolData.status || 'completed',
                error: toolData.error
            }));
        } else {
            // Consider logging this error via a proper logging service instance if needed
            console.warn('Malformed tool data found in context during persistence', { originId, toolData });
        }
    }

    // Now save everything to MongoDB in a more optimized way
    // 1. Save the tools first
    let savedAnswerTools = [];
    let savedContextTools = [];

    if (answerToolObjects.length > 0) {
      savedAnswerTools = await Tool.insertMany(answerToolObjects);
      answer.tools = savedAnswerTools.map(tool => tool._id);
    } else {
      answer.tools = [];
    }

    if (contextToolObjects.length > 0) {
      savedContextTools = await Tool.insertMany(contextToolObjects);
      context.tools = savedContextTools.map(tool => tool._id);
    } else {
      context.tools = [];
    }

    // 2. Save other entities
    await context.save();
    await citation.save();
    await answer.save();
    await question.save();

    // 3. Complete the interaction references and save
    dbInteraction.answer = answer._id;
    dbInteraction.question = question._id;
    await dbInteraction.save();

    // 4. Update and save the parent document (Chat or Batch)
    let parentDoc = null;
    if (originType === 'chat') {
      // Find or create Chat document
      parentDoc = await Chat.findOne({ chatId: originId });
      if (!parentDoc) {
        parentDoc = new Chat({ 
          chatId: originId,
          // Populate other fields if available in interactionData
          aiProvider: interaction.selectedAI, 
          searchProvider: interaction.searchProvider,
          pageLanguage: interaction.pageLanguage 
        });
      }
    } else if (originType === 'batch') {
      // Find Batch document (assuming originId is the batchId or _id)
      // Using batchId which seems to be the identifier in the Batch model
      parentDoc = await Batch.findOne({ batchId: originId }); 
      if (!parentDoc) {
         throw new Error(`BatchRun with batchId ${originId} not found.`);
      }
    } else {
      throw new Error(`Invalid originContext type: ${originType}`);
    }

    parentDoc.interactions.push(dbInteraction._id);
    await parentDoc.save();

    // 5. Return the saved Interaction document (potentially populated)
    // Returning the basic saved interaction for now. Can populate later if needed.
    return dbInteraction; 
  }

  // --- Placeholder methods for other CRUD operations ---

  async findChatById(chatId) {
    await this.ensureDbConnection();
    // Populate interactions with specific fields needed for history conversion
    return Chat.findOne({ chatId: chatId })
      .populate({
        path: 'interactions',
        populate: [
          { path: 'question', select: 'redactedQuestion' }, // Select only redactedQuestion
          { path: 'answer', select: 'content' }           // Select only content
        ]
      });
  }

  async findInteractionById(interactionId) {
    await this.ensureDbConnection();
    // Example: Populate related docs for detailed view
    return Interaction.findById(interactionId)
      .populate('answer')
      .populate('question')
      .populate('context');
  }

  async findBatchRunById(batchRunId) {
    await this.ensureDbConnection();
    return Batch.findOne({ batchId: batchRunId }).populate('interactions'); // Assuming batchId is unique identifier
  }

  async createBatchRun(batchData) {
    await this.ensureDbConnection();
    const newBatch = new Batch(batchData); // Or BatchRun model
    return newBatch.save();
  }

  async updateBatchRunStatus(batchRunId, status, progressInfo) {
    await this.ensureDbConnection();
    return Batch.updateOne({ batchId: batchRunId }, { status: status, ...progressInfo }); // Example update
  }

  async getChatLogs(filters) {
     await this.ensureDbConnection();
     // Implement logic to query interactions/chats based on filters
     console.log('getChatLogs called with filters:', filters);
     return Promise.resolve([]); // Placeholder
  }

  async persistFeedback(feedbackData) {
     await this.ensureDbConnection();
     // Implement logic to find interaction and update/create ExpertFeedback
     console.log('persistFeedback called with:', feedbackData);
     return Promise.resolve({}); // Placeholder
  }

  async deleteChat(chatId) {
     await this.ensureDbConnection();
     const chat = await Chat.findOne({ chatId: chatId });
     if (chat) {
       // Use pre-hook defined in Chat model for cascading delete
       await chat.deleteOne();
       return { message: 'Chat deleted successfully' };
     }
     return { message: 'Chat not found' };
  }

  // Add other methods as needed (e.g., findUser, saveUser, etc.)

}

// Export a singleton instance
export default new DataStoreService();
