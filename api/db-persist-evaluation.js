/**
 * API endpoint for persisting evaluation data
 */
import mongoose from 'mongoose';
import { ExpertFeedback } from '../models/expertFeedback.js';
import { Interaction } from '../models/interaction.js';

/**
 * Save evaluation data to database
 * @param {object} req - Request object
 * @param {object} res - Response object
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { questionId, interactionId, evaluation, type = 'ai' } = req.body;

    if ((!questionId && !interactionId) || !evaluation) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: either questionId or interactionId, and evaluation are required'
      });
    }

    // Map evaluation data to ExpertFeedback model structure
    // We're using the existing expertFeedback schema/model since we don't want to modify the persistence layer yet
    const mappedData = {
      // Calculate overall score
      totalScore: evaluation.overallScore || 0,
      
      // Map sentence scores if they exist
      ...(evaluation.sentenceScores && evaluation.sentenceScores.length > 0 ? {
        sentence1Score: evaluation.sentenceScores[0]?.score || -1,
        sentence1Explanation: evaluation.sentenceScores[0]?.feedback || '',
        
        sentence2Score: evaluation.sentenceScores[1]?.score || -1,
        sentence2Explanation: evaluation.sentenceScores[1]?.feedback || '',
        
        sentence3Score: evaluation.sentenceScores[2]?.score || -1,
        sentence3Explanation: evaluation.sentenceScores[2]?.feedback || '',
        
        sentence4Score: evaluation.sentenceScores[3]?.score || -1,
        sentence4Explanation: evaluation.sentenceScores[3]?.feedback || '',
      } : {}),
      
      // Additional fields
      answerImprovement: evaluation.improvement || '',
      feedback: `Auto-evaluation by ${type}`,
      
      // Store the raw evaluation data for reference
      __evaluationData: JSON.stringify(evaluation),
      __evaluationType: type
    };

    // Create the expert feedback document
    const feedbackDoc = new ExpertFeedback({
      ...mappedData,
      ...(questionId && { questionId: new mongoose.Types.ObjectId(questionId) })
    });

    // Save to database
    await feedbackDoc.save();

    // If interactionId is provided, update the interaction with this feedback
    if (interactionId) {
      const interaction = await Interaction.findOne({ interactionId });
      if (interaction) {
        // Add this feedback to the aiFeedback array
        if (!interaction.aiFeedback) {
          interaction.aiFeedback = [];
        }
        interaction.aiFeedback.push(feedbackDoc._id);
        await interaction.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Evaluation saved successfully',
      id: feedbackDoc._id
    });
  } catch (error) {
    console.error('Error saving evaluation:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}