import dbConnect from './db-connect.js';
import { Chat } from '../../models/chat.js';
import { Interaction } from '../../models/interaction.js';
import { Context } from '../../models/context.js';
import { Question } from '../../models/question.js';
import { Citation } from '../../models/citation.js';
import { Answer } from '../../models/answer.js';
import { Tool } from '../../models/tool.js';
import EmbeddingService from '../../services/EmbeddingService.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';
import EvaluationService from '../../services/EvaluationService.js';



export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await dbConnect();

    const interaction = req.body;
    let chatId = interaction.chatId;
    let chat = await Chat.findOne({ chatId: chatId });

    if (!chat) {
      chat = new Chat();
    }
    chat.chatId = interaction.chatId;
    chat.aiProvider = interaction.selectedAI;
    chat.searchProvider = interaction.searchProvider;
    chat.pageLanguage = interaction.pageLanguage;
    
    // Create all MongoDB document objects without saving them yet
    const dbInteraction = new Interaction();
    dbInteraction.interactionId = interaction.userMessageId;
    dbInteraction.responseTime = interaction.responseTime;
    dbInteraction.referringUrl = interaction.referringUrl;
    
    const context = new Context();
    Object.assign(context, interaction.context);
    dbInteraction.context = context._id;

    const citation = new Citation();
    citation.aiCitationUrl = interaction.answer.citationUrl;
    citation.providedCitationUrl = interaction.finalCitationUrl;
    citation.confidenceRating = interaction.confidenceRating;
    citation.citationHead = interaction.answer.citationHead;

    const answer = new Answer();
    answer.citation = citation._id;
    Object.assign(answer, interaction.answer);
    answer.sentences = interaction.answer.sentences;
    
    const question = new Question();
    question.redactedQuestion = interaction.question;
    question.language = interaction.answer.questionLanguage;
    question.englishQuestion = interaction.answer.englishQuestion;

    
    // Handle tools data with proper validation
    const toolsData = Array.isArray(interaction.answer.tools) ? interaction.answer.tools : [];
    const toolObjects = toolsData.map(toolData => new Tool({
      tool: toolData.tool,
      input: toolData.input,
      output: toolData.output,
      startTime: toolData.startTime,
      endTime: toolData.endTime,
      duration: toolData.duration,
      status: toolData.status || 'completed',
      error: toolData.error
    }));
    
    // Now save everything to MongoDB in a more optimized way
    // 1. Save the tools first
    if (toolObjects.length > 0) {
      const savedTools = await Tool.insertMany(toolObjects);
      answer.tools = savedTools.map(tool => tool._id);
    } else {
      answer.tools = [];
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
    
    // 4. Update and save the chat
    chat.interactions.push(dbInteraction._id);
    await chat.save();

    // 5. Generate embeddings for the interaction
    await EmbeddingService.createEmbedding(dbInteraction);
 

    // 6. Perform evaluation on the saved interaction
    try {
      ServerLoggingService.info('Starting evaluation for interaction', chat.chatId, { });
      const evaluationResult = await EvaluationService.evaluateInteraction(dbInteraction, chatId);
      if (evaluationResult) {
        ServerLoggingService.info('Evaluation completed successfully', chat.chatId, {
          evaluationId: evaluationResult._id
        });
      }
    } catch (evalError) {
      // Log evaluation error but don't fail the request
      ServerLoggingService.error('Evaluation failed', chat.chatId, evalError);
    }

    res.status(200).json({ message: 'Interaction logged successfully' });
  } catch (error) {
    ServerLoggingService.error('Failed to log interaction', req.body?.chatId || 'system', error);
    res.status(500).json({ message: 'Failed to log interaction', error: error.message });
  }
}