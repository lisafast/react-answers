import mongoose from 'mongoose';
import { User } from '../models/user.js'; // Assuming User model exists and is needed for userId validation/population
import { Chat } from '../models/chat.js';
import { Interaction } from '../models/interaction.js';
import { Context } from '../models/context.js';
import { Question } from '../models/question.js';
import { Citation } from '../models/citation.js';
import { Answer } from '../models/answer.js';
import { Tool } from '../models/tool.js';
import { Batch } from '../models/batch.js';
import dbConnect from '../api/db/db-connect.js';
import PromptOverride from '../models/promptOverride.js'; // Added PromptOverride model
import ServerLoggingService from './ServerLoggingService.js'; // Added for logging within new methods

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

  // --- Prompt Override Methods ---

  /**
   * Gets a specific active prompt override for a given user and filename.
   * @param {string} userId - The ID of the user.
   * @param {string} filename - The filename of the prompt.
   * @returns {Promise<PromptOverride|null>} The active override document or null.
   */
  async getPromptOverride(userId, filename) {
    await this.ensureDbConnection();
    try {
      const override = await PromptOverride.findOne({ userId, filename, isActive: true });
      return override;
    } catch (error) {
      ServerLoggingService.error('Error fetching active prompt override', null, { userId, filename, error: error.message });
      throw error; // Rethrow or handle as appropriate
    }
  }

  /**
   * Gets all prompt overrides for a specific user, regardless of active status.
   * Useful for the management page.
   * @param {string} userId - The ID of the user.
   * @returns {Promise<Array<PromptOverride>>} An array of override documents.
   */
  async getAllUserOverrides(userId) {
    await this.ensureDbConnection();
    try {
      const overrides = await PromptOverride.find({ userId });
      return overrides;
    } catch (error) {
      ServerLoggingService.error('Error fetching all user prompt overrides', null, { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Saves (creates or updates) a prompt override for a user.
   * If creating, sets isActive to true by default. If updating, preserves isActive status unless explicitly changed.
   * @param {string} userId - The ID of the user.
   * @param {string} filename - The filename of the prompt.
   * @param {string} content - The new content for the prompt override.
   * @returns {Promise<PromptOverride>} The saved override document.
   */
  async savePromptOverride(userId, filename, content) {
    await this.ensureDbConnection();
    try {
      // Use findOneAndUpdate with upsert:true to create if not exists, update if exists
      const updatedOverride = await PromptOverride.findOneAndUpdate(
        { userId, filename },
        {
          $set: { content }, // Update the content
          $setOnInsert: { isActive: true, userId, filename } // Set fields only on insert (creation)
        },
        {
          new: true, // Return the modified document
          upsert: true, // Create if it doesn't exist
          runValidators: true, // Ensure schema validation runs
        }
      );
      ServerLoggingService.info('Prompt override saved successfully', null, { userId, filename });
      return updatedOverride;
    } catch (error) {
      ServerLoggingService.error('Error saving prompt override', null, { userId, filename, error: error.message });
      throw error;
    }
  }

  /**
   * Sets the active state of a specific prompt override for a user.
   * @param {string} userId - The ID of the user.
   * @param {string} filename - The filename of the prompt.
   * @param {boolean} isActive - The desired active state.
   * @returns {Promise<object>} The update result object from MongoDB.
   */
  async setPromptOverrideActiveState(userId, filename, isActive) {
    await this.ensureDbConnection();
    try {
      // Options for the update operation
      const updateOptions = {};
      if (isActive) {
       // Only upsert (create if not found) when activating - REMOVED, upsert logic moved to API handler
       // updateOptions.upsert = true;
     }

     // Update only, do not upsert from this method anymore
     const result = await PromptOverride.updateOne(
       { userId, filename },
       { $set: { isActive } }
       // Removed updateOptions
     );

     // Logging based on the result of the update attempt
      if (isActive) {
        if (result.upsertedCount > 0 || result.modifiedCount > 0) {
           ServerLoggingService.info('Prompt override activated (created or updated)', null, { userId, filename });
        } else if (result.matchedCount > 0 && result.modifiedCount === 0) {
           // This case means it existed but was already active - still success
           ServerLoggingService.info('Prompt override already active', null, { userId, filename });
        } else {
           // Should not happen with upsert:true, log warning if it does
          // This case should no longer happen if upsert is removed, but keep log just in case
          ServerLoggingService.warn('Unexpected result when trying to update prompt override active state', null, { userId, filename, result });
        }
      } else { // Deactivating
         if (result.matchedCount === 0) {
            // Log that it didn't exist, but this isn't an error for deactivation
            ServerLoggingService.info('Attempted to deactivate non-existent prompt override', null, { userId, filename });
         } else if (result.modifiedCount > 0) {
            // Log successful deactivation
            ServerLoggingService.info('Prompt override deactivated successfully', null, { userId, filename, isActive });
         } else {
            // Matched but not modified (was already inactive)
            ServerLoggingService.info('Prompt override already inactive', null, { userId, filename });
         }
      }
      // Return the result object
      return result;
    } catch (error) {
      ServerLoggingService.error('Error setting prompt override active state', null, { userId, filename, isActive, error: error.message });
      throw error;
    }
  }

  /**
   * Deletes a specific prompt override for a user.
   * @param {string} userId - The ID of the user.
   * @param {string} filename - The filename of the prompt.
   * @returns {Promise<object>} The deletion result object from MongoDB.
   */
  async deletePromptOverride(userId, filename) {
    await this.ensureDbConnection();
    try {
      const result = await PromptOverride.deleteOne({ userId, filename });
      if (result.deletedCount > 0) {
        ServerLoggingService.info('Prompt override deleted successfully', null, { userId, filename });
      } else {
        ServerLoggingService.warn('Attempted to delete non-existent prompt override', null, { userId, filename });
      }
      return result;
    } catch (error) {
      ServerLoggingService.error('Error deleting prompt override', null, { userId, filename, error: error.message });
      throw error;
    }
  }

  // Add other methods as needed (e.g., findUser, saveUser, etc.)

}

// Export a singleton instance
export default new DataStoreService();
