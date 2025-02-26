import xlsx from 'xlsx';
import fs from 'fs';
import { createReadStream } from 'fs';
import { createResearchAgent, createEvaluatorAgent } from '../agents/AgentService.js';
import SimilarityService from './SimilarityService.js';
import { DataStoreService } from '../src/services/DataStoreService.js';

/**
 * Service for evaluating answer quality and providing scoring and feedback
 */
class EvaluationService {
  static researchAgent = null;
  static evaluatorAgent = null;

  /**
   * Initialize the evaluation service agents
   */
  static async initialize() {
    if (!EvaluationService.researchAgent || !EvaluationService.evaluatorAgent) {
      EvaluationService.researchAgent = await createResearchAgent();
      EvaluationService.evaluatorAgent = await createEvaluatorAgent();
    }
  }

  /**
   * Evaluate an answer based on a question
   * @param {string} question - The question that was asked
   * @param {string} answer - The answer to evaluate
   * @returns {Promise<object>} Evaluation results
   */
  static async evaluateAnswer(question, answer, interactionId = null) {
    try {
      // Step 1: Find similar questions with highly-rated answers
      const similarQuestions = await SimilarityService.findSimilarQuestions(question);
      
      // Step 2: If we have similar golden answers, use them for comparison
      if (similarQuestions.length > 0) {
        const evaluation = await this.compareWithGoldenAnswers(answer, similarQuestions);
        if (interactionId) {
          await DataStoreService.persistEvaluation(interactionId, evaluation, 'comparison');
        }
        return {
          success: true,
          evaluation
        };
      }
      
      // Step 3: If no similar questions, perform pure AI evaluation
      const aiEvaluation = await this.performAIEvaluation(question, answer);
      if (interactionId) {
        await DataStoreService.persistEvaluation(interactionId, aiEvaluation, 'claude-3-7-sonnet');
      }
      return {
        success: true,
        evaluation: aiEvaluation
      };
    } catch (error) {
      console.error('Error in evaluation process:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Compare the current answer with golden answers
   * @param {string} currentAnswer - The answer to evaluate
   * @param {Array} similarQuestions - Similar questions with their golden answers
   * @returns {Promise<object>} Evaluation results
   */
  static async compareWithGoldenAnswers(currentAnswer, similarQuestions) {
    // Break down answers into sentences
    const currentSentences = this.breakIntoSentences(currentAnswer);
    
    // For each similar question, compare the current answer with the golden answer
    const evaluations = [];
    
    for (const question of similarQuestions) {
      const goldenAnswer = question.answer;
      const goldenSentences = this.breakIntoSentences(goldenAnswer);
      
      // Compare sentences and generate scores
      const sentenceScores = [];
      
      for (const [index, sentence] of currentSentences.entries()) {
        // Find the most similar sentence in the golden answer
        let bestScore = 0;
        let feedback = '';
        let mostSimilarGoldenSentence = '';
        
        for (const goldenSentence of goldenSentences) {
          const similarity = await SimilarityService.calculateCosineSimilarity(
            sentence, goldenSentence
          );
          
          if (similarity > bestScore) {
            bestScore = similarity;
            mostSimilarGoldenSentence = goldenSentence;
            // If score is below threshold, prepare to provide feedback
            if (bestScore < 0.9) {
              feedback = await this.generateFeedback(sentence, goldenSentence);
            }
          }
        }
        
        sentenceScores.push({
          sentence,
          mostSimilarGoldenSentence,
          score: Math.round(bestScore * 100),
          feedback
        });
      }
      
      evaluations.push({
        similarQuestion: question.question,
        goldenAnswer: question.answer,
        sentenceScores
      });
    }
    
    return this.aggregateEvaluations(evaluations);
  }
  
  /**
   * Use AI to evaluate an answer when no golden answers are available
   * @param {string} question - The question being answered
   * @param {string} answer - The answer to evaluate
   * @returns {Promise<object>} AI-generated evaluation
   */
  static async performAIEvaluation(question, answer) {
    await this.initialize();
    
    // Break the answer into sentences
    const sentences = this.breakIntoSentences(answer);
    const sentenceScores = [];
    
    for (const sentence of sentences) {
      // Evaluate each sentence individually
      const evaluationResult = await this.evaluatorAgent.invoke({
        messages: [
          {
            role: "system",
            content: `You are an expert evaluator assessing the accuracy of answers. 
            Evaluate this sentence from an answer to the following question:
            
            Question: ${question}
            
            Sentence to evaluate: "${sentence}"
            
            Rate the sentence on a scale of 0-100 where:
            - 100 = Completely accurate, relevant and helpful
            - 75 = Mostly accurate with minor issues
            - 50 = Partially accurate but has significant issues
            - 25 = Mostly inaccurate but contains some correct elements
            - 0 = Completely inaccurate or irrelevant
            
            If the score is below 100, provide specific feedback explaining why and how it could be improved.
            
            Respond in this format only:
            <evaluation>
            <score>X</score>
            <feedback>Your detailed feedback here if score is below 100</feedback>
            </evaluation>`
          }
        ]
      });
      
      // Extract score and feedback from evaluation
      const content = evaluationResult.messages[evaluationResult.messages.length - 1].content;
      const scoreMatch = /<score>(.*?)<\/score>/s.exec(content);
      const feedbackMatch = /<feedback>(.*?)<\/feedback>/s.exec(content);
      
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
      const feedback = (feedbackMatch && score < 100) ? feedbackMatch[1].trim() : '';
      
      sentenceScores.push({
        sentence,
        score,
        feedback
      });
    }
    
    // Calculate overall score
    const overallScore = this.calculateOverallScore(sentenceScores);
    
    return {
      sentenceScores,
      overallScore
    };
  }
  
  /**
   * Generate feedback by comparing two sentences
   * @param {string} sentence - The sentence being evaluated
   * @param {string} goldenSentence - The reference golden sentence
   * @returns {Promise<string>} Feedback explaining differences
   */
  static async generateFeedback(sentence, goldenSentence) {
    await this.initialize();
    
    const result = await this.evaluatorAgent.invoke({
      messages: [
        {
          role: "system",
          content: `You are an expert evaluator comparing two sentences. 
          The first sentence is from an answer being evaluated.
          The second sentence is from a high-quality "golden" answer.
          
          Sentence being evaluated: "${sentence}"
          
          Golden reference sentence: "${goldenSentence}"
          
          Provide brief, specific feedback explaining:
          1. What information is missing, incorrect or could be improved in the evaluated sentence
          2. How the evaluated sentence could be made more accurate based on the golden sentence
          
          Keep your feedback concise and actionable, focusing only on substantive differences.`
        }
      ]
    });
    
    return result.messages[result.messages.length - 1].content;
  }
  
  /**
   * Break text into sentences
   * @param {string} text - Text to split into sentences
   * @returns {Array<string>} Array of sentences
   */
  static breakIntoSentences(text) {
    if (!text) return [];
    
    // Split on sentence boundaries (period, question mark, exclamation point followed by space or end)
    const rawSentences = text.split(/(?<=[.!?])\s+|(?<=[.!?])$/);
    
    // Filter out empty strings and clean up
    return rawSentences
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  
  /**
   * Calculate overall score from sentence scores
   * @param {Array} sentenceScores - Array of sentence scores
   * @returns {number} Overall weighted score
   */
  static calculateOverallScore(sentenceScores) {
    if (!sentenceScores || sentenceScores.length === 0) return 0;
    
    // Calculate weighted average based on sentence length
    const totalLength = sentenceScores.reduce((sum, item) => sum + item.sentence.length, 0);
    const weightedSum = sentenceScores.reduce((sum, item) => 
      sum + (item.score * (item.sentence.length / totalLength)), 0);
    
    return Math.round(weightedSum);
  }
  
  /**
   * Aggregate evaluations from multiple similar questions
   * @param {Array} evaluations - Array of evaluations from similar questions
   * @returns {object} Aggregated evaluation
   */
  static aggregateEvaluations(evaluations) {
    // Extract all sentence scores across evaluations
    const allSentenceScores = evaluations.flatMap(eval => 
      eval.sentenceScores.map(score => ({
        ...score,
        similarQuestion: eval.similarQuestion
      }))
    );
    
    // Group by sentence to get the average score for each
    const sentenceMap = new Map();
    for (const score of allSentenceScores) {
      if (!sentenceMap.has(score.sentence)) {
        sentenceMap.set(score.sentence, {
          sentence: score.sentence,
          scores: [score.score],
          feedback: score.feedback ? [score.feedback] : []
        });
      } else {
        const existing = sentenceMap.get(score.sentence);
        existing.scores.push(score.score);
        if (score.feedback) {
          existing.feedback.push(score.feedback);
        }
      }
    }
    
    // Calculate average score and combine feedback for each sentence
    const aggregatedScores = Array.from(sentenceMap.values()).map(item => {
      const averageScore = Math.round(item.scores.reduce((sum, s) => sum + s, 0) / item.scores.length);
      return {
        sentence: item.sentence,
        score: averageScore,
        feedback: item.feedback.length > 0 ? item.feedback[0] : '' // Just take the first feedback for simplicity
      };
    });
    
    return {
      sentenceScores: aggregatedScores,
      overallScore: this.calculateOverallScore(aggregatedScores),
      similarQuestions: evaluations.map(e => e.similarQuestion)
    };
  }
  
  /**
   * Start the evaluation process for a batch of questions
   * @param {string} goldenFilePath - Path to golden answers file
   * @param {string} brownFilePath - Path to brown answers file
   * @param {number} duration - Time range to evaluate in days
   * @returns {Promise<boolean>} Success status
   */
  static async startEvaluation(goldenFilePath, brownFilePath, duration) {
    try {
      const response = await fetch(`/api/chat-logs?days=${duration}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch chat logs');
      }

      const questionsToEvaluate = data.logs.filter(chat => !chat.expertRating);

      if (questionsToEvaluate.length === 0) {
        console.log('No questions to evaluate');
        return true;
      }

      for (const question of questionsToEvaluate) {
        await this.evaluateAnswer(question.question, question.answer, question.id);
      }

      return true;
    } catch (error) {
      console.error('Error in batch evaluation process:', error);
      throw error;
    }
  }

  /**
   * Parse Excel file with evaluation data
   * @param {string} filePath - Path to the Excel file
   * @returns {Promise<Array>} Parsed data from the file
   */
  static parseXLSXFile(filePath) {
    return new Promise((resolve, reject) => {
      try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const results = xlsx.utils.sheet_to_json(worksheet);
        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  }
}

export default EvaluationService;