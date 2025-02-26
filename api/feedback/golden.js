/**
 * API endpoint to retrieve golden answers (highly rated answers)
 */
import { connectToDatabase } from './db-connect.js';
import { ExpertFeedback } from '../models/expertFeedback.js';
import { Question } from '../models/question.js';
import { Answer } from '../models/answer.js';

/**
 * Get golden answers from the database
 * @param {object} req - Request object
 * @param {object} res - Response object
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    await connectToDatabase();
    
    // Get minimum score threshold from query params (default 95)
    const minScore = parseInt(req.query.minScore || 95, 10);
    
    // Find expert feedbacks with high total scores
    const expertFeedbacks = await ExpertFeedback.find({
      totalScore: { $gte: minScore }
    }).lean();
    
    if (!expertFeedbacks.length) {
      return res.status(200).json({
        success: true,
        goldenAnswers: []
      });
    }
    
    // Get question IDs from the expert feedbacks
    const questionIds = expertFeedbacks.map(feedback => feedback.questionId);
    
    // Get the questions and their answers
    const questions = await Question.find({
      _id: { $in: questionIds }
    }).lean();
    
    const answers = await Answer.find({
      questionId: { $in: questionIds }
    }).lean();
    
    // Map questions, answers, and expert feedback together
    const goldenAnswers = questions.map(question => {
      const answer = answers.find(a => a.questionId.toString() === question._id.toString());
      const feedback = expertFeedbacks.find(f => f.questionId.toString() === question._id.toString());
      
      if (!answer) return null;
      
      return {
        questionId: question._id,
        question: question.content,
        answer: answer.content,
        score: feedback?.totalScore || 100,
        feedback: feedback?.feedback || '',
        timestamp: question.createdAt
      };
    }).filter(Boolean); // Remove null entries
    
    return res.status(200).json({
      success: true,
      goldenAnswers
    });
    
  } catch (error) {
    console.error('Error retrieving golden answers:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}