import { Embedding } from '../models/embedding.js';
import { Question } from '../models/question.js';
import { Interaction } from '../models/interaction.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const EmbeddingService = {
  async generateEmbedding(text) {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: text,
        encoding_format: "float"
      });
      
      return {
        model: response.model,
        vector: response.data[0].embedding,
        dimension: response.data[0].embedding.length,
        processedText: text
      };
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  },

  createSlidingWindowText(currentQuestion, previousQuestion = null) {
    if (!previousQuestion) {
      return currentQuestion;
    }
    return `${previousQuestion}\n${currentQuestion}`;
  },

  async getPreviousQuestionFromChat(chat, currentInteractionId) {
    if (!chat?.interactions?.length <= 1) {
      return null;
    }
    
    const currentIndex = chat.interactions.findIndex(
      interactionId => interactionId.toString() === currentInteractionId.toString()
    );
    
    if (currentIndex <= 0) {
      return null;
    }
    
    const previousInteractionId = chat.interactions[currentIndex - 1];
    const previousInteraction = await Interaction.findById(previousInteractionId);
    
    if (!previousInteraction?.question) {
      return null;
    }
    
    const previousQuestion = await Question.findById(previousInteraction.question);
    return previousQuestion ? previousQuestion.redactedQuestion : null;
  },

  async createQuestionEmbedding({ questionText, chat, interactionId, questionId }) {
    try {
      const previousQuestionText = await this.getPreviousQuestionFromChat(chat, interactionId);
      const textForEmbedding = this.createSlidingWindowText(questionText, previousQuestionText);
      const embeddingData = await this.generateEmbedding(textForEmbedding);
      
      const embedding = new Embedding({
        ...embeddingData,
        objectId: questionId,
        objectType: 'question',
        metadata: {
          chatId: chat._id,
          interactionId: interactionId,
          hasPreviousContext: !!previousQuestionText
        }
      });
      
      await embedding.save();
      console.log(`Embedding created for question ID: ${questionId}`);
      return embedding;
    } catch (error) {
      console.error('Error creating question embedding:', error);
      throw error;
    }
  },

  async createAnswerEmbedding({ answerText, answerId }) {
    try {
      const embeddingData = await this.generateEmbedding(answerText);
      const embedding = new Embedding({
        ...embeddingData,
        objectId: answerId,
        objectType: 'answer',
        metadata: {}
      });
      
      await embedding.save();
      console.log(`Embedding created for answer ID: ${answerId}`);
      return embedding;
    } catch (error) {
      console.error('Error creating answer embedding:', error);
      throw error;
    }
  }
};

export default EmbeddingService;