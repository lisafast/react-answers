/**
 * API endpoint for evaluation services
 */
import { EvaluationService } from '../services/EvaluationService.js';

/**
 * Evaluate an answer for accuracy based on a question
 * @param {object} req - Request object
 * @param {object} res - Response object
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { questionId, question, answer } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: question and answer are required'
      });
    }

    // Call the evaluation service to evaluate the answer
    const evaluationResult = await EvaluationService.evaluateAnswer(
      question,
      answer,
      questionId
    );

    return res.status(200).json({
      success: true,
      evaluation: evaluationResult
    });
  } catch (error) {
    console.error('Error in evaluation API:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}