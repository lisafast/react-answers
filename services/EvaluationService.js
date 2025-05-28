import mongoose from 'mongoose';
import { Interaction } from '../models/interaction.js';
import { Eval } from '../models/eval.js';
import { ExpertFeedback } from '../models/expertFeedback.js';
import ServerLoggingService from './ServerLoggingService.js';
import dbConnect from '../api/db/db-connect.js';
import config from '../config/eval.js';
import { Chat } from '../models/chat.js';

import Piscina from 'piscina';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const numCPUs = os.cpus().length;
const pool = new Piscina({
  filename: path.resolve(__dirname, 'evaluation.worker.js'),
  minThreads: 1,
  maxThreads: Math.max(1, numCPUs > 1 ? numCPUs - 1 : 1),
});

class EvaluationService {
    async evaluateInteraction(interaction, chatId) {
        if (!interaction || !interaction._id) {
            ServerLoggingService.error('Invalid interaction object passed to evaluateInteraction', chatId, 
                { hasInteraction: !!interaction, hasId: !!interaction?._id });
            // Return a rejected promise or throw an error for consistency, as the method is async.
            // Throwing is fine as it will result in a rejected promise.
            throw new Error('Invalid interaction object'); 
        }
        const interactionIdStr = interaction._id.toString();
        try {
            ServerLoggingService.debug('Dispatching evaluation task to worker', chatId, { interactionId: interactionIdStr });
            // Return the promise from pool.run() directly.
            // The caller (e.g., processEvaluationsForDuration) will await this promise
            // and handle its resolution or rejection.
            return pool.run({ interactionId: interactionIdStr, chatId });
        } catch (error) {
            // This catch block will only handle synchronous errors from pool.run() itself (e.g., pool closed).
            // Errors during worker execution will cause the promise returned by pool.run() to reject.
            ServerLoggingService.error('Error synchronously dispatching task to evaluation worker', chatId, { 
                interactionId: interactionIdStr, 
                errorMessage: error.message,
            });
            // Re-throw the error so the caller's await will reject.
            throw error;
        }
    }

    // Check if an interaction already has an evaluation
    async hasExistingEvaluation(interactionId) {
        await dbConnect();
        try {
            const interaction = await Interaction.findById(interactionId).populate('autoEval');
            ServerLoggingService.debug(`Checked for existing evaluation`, interactionId.toString(), {
                exists: !!interaction?.autoEval
            });
            return !!interaction?.autoEval;
        } catch (error) {
            ServerLoggingService.error('Error checking for existing evaluation', interactionId.toString(), error);
            return false;
        }
    }

    // Get evaluation for a specific interaction
    async getEvaluationForInteraction(interactionId) {
        await dbConnect();
        try {
            const interaction = await Interaction.findById(interactionId).populate('autoEval');
            const evaluation = interaction?.autoEval;

            if (evaluation) {
                ServerLoggingService.debug('Retrieved evaluation', interactionId.toString(), {
                    evaluationId: evaluation._id
                });
            } else {
                ServerLoggingService.debug('No evaluation found', interactionId.toString());
            }

            return evaluation;
        } catch (error) {
            ServerLoggingService.error('Error retrieving evaluation', interactionId.toString(), error);
            return null;
        }
    }

    /**
     * Process interactions for evaluation for a specified duration.
     * This method will now call the worker-offloaded `evaluateInteraction`.
     */
    async processEvaluationsForDuration(duration, skipExisting = true, lastProcessedId = null) {
        const startTime = Date.now();
        let lastId = lastProcessedId;

        try {
            await dbConnect();

            // If skipExisting is false and this is the first batch (no lastProcessedId),
            // delete all existing evaluations and expert feedback
            if (!skipExisting && !lastProcessedId) {
                ServerLoggingService.info('Regenerating all evaluations - deleting existing evaluations', 'system');
                
                // First get all evals to find the expert feedback IDs
                const allEvals = await Eval.find({});
                const expertFeedbackIds = allEvals
                    .map(evaluation => evaluation.expertFeedback)
                    .filter(id => id); // Filter out null/undefined values
                
                // Delete all evaluations
                await Eval.deleteMany({});
                ServerLoggingService.info(`Deleted ${allEvals.length} evaluations`, 'system');
                
                // Delete associated expert feedback
                if (expertFeedbackIds.length > 0) {
                    await ExpertFeedback.deleteMany({ _id: { $in: expertFeedbackIds } });
                    ServerLoggingService.info(`Deleted ${expertFeedbackIds.length} expert feedback records`, 'system');
                }
                
                // Clear autoEval field from all interactions
                await Interaction.updateMany(
                    { autoEval: { $exists: true } },
                    { $unset: { autoEval: "" } }
                );
                ServerLoggingService.info('Reset autoEval field in all interactions', 'system');
            }

            // Find interactions that have both question and answer
            const query = {
                question: { $exists: true, $ne: null },
                answer: { $exists: true, $ne: null }
            };

            // If skipExisting is true, exclude interactions that already have evaluations
            if (skipExisting) {
                query.autoEval = { $exists: false };
            }

            // Add pagination using lastProcessedId if provided
            if (lastId) {
                query._id = { $gt: new mongoose.Types.ObjectId(lastId) };
            }

            // Find interactions to evaluate, sorted by _id for consistent pagination
            const interactions = await Interaction.find(query)
                .sort({ _id: 1 })
                .limit(100) // Process in batches of 100
                .populate('question answer');

            // Process each interaction until time runs out
            for (const interaction of interactions) {
                if ((Date.now() - startTime) / 1000 >= duration) {
                    break;
                }
                const chats = await Chat.find({ interactions: interaction._id });
                const chatId = chats.length > 0 ? chats[0].chatId : null;
                await this.evaluateInteraction(interaction, chatId);
                lastId = interaction._id.toString();
            }

            // Calculate and return only remaining count
            const remainingQuery = {
                ...query,
                _id: { $gt: new mongoose.Types.ObjectId(lastId || '000000000000000000000000') }
            };
            
            return {
                remaining: await Interaction.countDocuments(remainingQuery),
                lastProcessedId: lastId
            };
        } catch (error) {
            ServerLoggingService.error('Error processing evaluations for duration', 'system', error);
            throw error;
        }
    }

}

export default new EvaluationService();