import mongoose from 'mongoose';
import { Interaction } from '../models/interaction.js';
import { Eval } from '../models/eval.js';
import { ExpertFeedback } from '../models/expertFeedback.js';
import { Embedding } from '../models/embedding.js';
import ServerLoggingService from './ServerLoggingService.js';
import dbConnect from '../api/db/db-connect.js';
import cosineSimilarity from 'compute-cosine-similarity';
import config from '../config/eval.js';
import { Chat } from '../models/chat.js';

class EvaluationService {
    async validateInteractionAndCheckExisting(interaction, chatId) {
        ServerLoggingService.debug('Validating interaction', chatId, {
            hasInteraction: !!interaction,
            hasQuestion: !!interaction?.question,
            hasAnswer: !!interaction?.answer
        });

        if (!interaction || !interaction.question || !interaction.answer) {
            ServerLoggingService.warn('Invalid interaction or missing question/answer', chatId);
            return null;
        }

        const existingEval = await Eval.findOne({ interaction: interaction._id });
        if (existingEval) {
            ServerLoggingService.info('Evaluation already exists for interaction', chatId, {
                evaluationId: existingEval._id
            });
            return existingEval;
        }

        ServerLoggingService.debug('Interaction validation successful', chatId);
        return true;
    }

    async getEmbeddingForInteraction(interaction) {
        ServerLoggingService.debug('Fetching embeddings for interaction', interaction._id.toString());
        
        const embedding = await Embedding.findOne({
            interactionId: interaction._id,
            questionsAnswerEmbedding: { $exists: true, $not: { $size: 0 } },
            answerEmbedding: { $exists: true, $not: { $size: 0 } },
            sentenceEmbeddings: { $exists: true, $not: { $size: 0 } }
        });

        if (!embedding) {
            ServerLoggingService.warn('No embeddings found for interaction', interaction._id.toString());
        } else {
            ServerLoggingService.debug('Found embeddings for interaction', interaction._id.toString(), {
                hasQuestionAnswerEmbedding: !!embedding.questionsAnswerEmbedding,
                hasAnswerEmbedding: !!embedding.answerEmbedding,
                sentenceEmbeddingsCount: embedding.sentenceEmbeddings?.length || 0
            });
        }

        return embedding;
    }

    async findSimilarEmbeddingsWithFeedback(sourceEmbedding, similarityThreshold = 0.85, limit = 20, timeLimit = 120) {
        ServerLoggingService.debug('Starting findSimilarEmbeddingsWithFeedback', 'system', {
            threshold: similarityThreshold,
            limit,
            timeLimit
        });

        const startTime = Date.now();
        const similarEmbeddings = [];
        let processedCount = 0;
        let skip = 0;
        const batchSize = 20; // Process expert feedback in smaller batches

        while ((Date.now() - startTime) / 1000 < timeLimit) {
            // Get expert feedback in batches, ordered by most recent first
            const expertFeedbackBatch = await ExpertFeedback.find({})
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(batchSize)
                .lean();

            if (expertFeedbackBatch.length === 0) {
                break; // No more expert feedback to process
            }

            ServerLoggingService.debug('Processing expert feedback batch', 'system', {
                batchSize: expertFeedbackBatch.length,
                currentSkip: skip,
                timeRemaining: Math.round(timeLimit - (Date.now() - startTime) / 1000)
            });

            // Process each expert feedback
            for (const feedback of expertFeedbackBatch) {
                // Check time limit before processing each feedback
                if ((Date.now() - startTime) / 1000 >= timeLimit) {
                    ServerLoggingService.info('Time limit reached, returning current matches', 'system', {
                        processedCount,
                        matchesFound: similarEmbeddings.length,
                        timeElapsed: (Date.now() - startTime) / 1000
                    });
                    return similarEmbeddings;
                }

                try {
                    // Find interaction and its embedding in a single query with projection
                    const interaction = await Interaction.findOne(
                        { expertFeedback: feedback._id },
                        { _id: 1, expertFeedback: 1, createdAt: 1 }
                    ).lean();

                    if (!interaction) continue;

                    const embedding = await Embedding.findOne({
                        interactionId: interaction._id,
                        questionsAnswerEmbedding: { $exists: true, $not: { $size: 0 } }
                    }).lean();

                    if (!embedding) continue;

                    // Calculate similarity
                    const similarity = cosineSimilarity(
                        sourceEmbedding.questionsAnswerEmbedding,
                        embedding.questionsAnswerEmbedding
                    );

                    processedCount++;

                    // Only add if it meets the threshold
                    if (similarity >= similarityThreshold) {
                        similarEmbeddings.push({
                            embedding: {
                                ...embedding,
                                interactionId: {
                                    _id: interaction._id,
                                    expertFeedback: feedback,
                                    createdAt: interaction.createdAt
                                }
                            },
                            similarity
                        });

                        // Sort by similarity and trim to limit
                        if (similarEmbeddings.length > limit) {
                            similarEmbeddings.sort((a, b) => b.similarity - a.similarity);
                            similarEmbeddings.length = limit;
                        }

                        // Exit early if we have enough high-quality matches
                        if (similarEmbeddings.length >= limit && 
                            similarEmbeddings[similarEmbeddings.length - 1].similarity >= similarityThreshold + 0.1) {
                            ServerLoggingService.debug('Found enough high-quality matches, exiting early', 'system', {
                                processedCount,
                                totalMatches: similarEmbeddings.length,
                                timeElapsed: (Date.now() - startTime) / 1000
                            });
                            return similarEmbeddings;
                        }
                    }

                    // Log progress periodically
                    if (processedCount % 100 === 0) {
                        ServerLoggingService.debug('Processing progress', 'system', {
                            processed: processedCount,
                            matchesFound: similarEmbeddings.length,
                            timeElapsed: (Date.now() - startTime) / 1000
                        });
                    }

                } catch (error) {
                    ServerLoggingService.error('Error processing feedback', feedback._id.toString(), error);
                }
            }

            skip += batchSize;
        }

        // Final sort by similarity
        similarEmbeddings.sort((a, b) => b.similarity - a.similarity);

        ServerLoggingService.info('Completed finding similar embeddings', 'system', {
            totalProcessed: processedCount,
            matchesFound: similarEmbeddings.length,
            timeElapsed: (Date.now() - startTime) / 1000,
            averageSimilarity: similarEmbeddings.length > 0 
                ? similarEmbeddings.reduce((sum, item) => sum + item.similarity, 0) / similarEmbeddings.length 
                : 0
        });

        return similarEmbeddings;
    }

    async findBestAnswerMatches(sourceEmbedding, similarEmbeddings, topMatches = 5) {
        // Calculate answer similarity for each embedding
        const answerMatches = similarEmbeddings
            .map(match => {
                const answerSimilarity = cosineSimilarity(
                    sourceEmbedding.answerEmbedding,
                    match.embedding.answerEmbedding
                );

                // Penalize answers with a different number of sentences
                const sentenceCountPenalty = Math.abs(
                    sourceEmbedding.sentenceEmbeddings.length -
                    match.embedding.sentenceEmbeddings.length
                ) * 0.05; // Penalty factor per sentence difference

                // Apply recency bias (newer embeddings are preferred)
                const recencyBias = match.embedding.interactionId.createdAt ?
                    (new Date() - new Date(match.embedding.interactionId.createdAt)) / (1000 * 60 * 60 * 24 * 365) : 0; // Age in years

                const recencyWeight = 0.1; // Weight for recency bias

                return {
                    ...match,
                    answerSimilarity: answerSimilarity - sentenceCountPenalty - (recencyBias * recencyWeight)
                };
            })
            .sort((a, b) => b.answerSimilarity - a.answerSimilarity)
            .slice(0, topMatches);

        return answerMatches;
    }

    async matchSentences(sourceEmbedding, targetEmbedding) {
        const sentenceMatches = [];

        // For each sentence in source embedding
        sourceEmbedding.sentenceEmbeddings.forEach((sourceSentenceEmb, sourceIndex) => {
            // Find the best matching sentence in target embedding
            let bestSimilarity = 0;
            let bestTargetIndex = -1;

            targetEmbedding.sentenceEmbeddings.forEach((targetSentenceEmb, targetIndex) => {
                const similarity = cosineSimilarity(sourceSentenceEmb, targetSentenceEmb);
                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                    bestTargetIndex = targetIndex;
                }
            });

            // If we found a good match, add it to our results
            if (bestSimilarity > config.thresholds.sentenceSimilarity && bestTargetIndex !== -1) {
                sentenceMatches.push({
                    sourceIndex,
                    targetIndex: bestTargetIndex,
                    similarity: bestSimilarity
                });
            }
        });

        return sentenceMatches;
    }

    async findBestSentenceMatches(sourceEmbedding, topMatches) {
        let bestSentenceMatches = [];
        let bestScores = new Array(sourceEmbedding.sentenceEmbeddings.length).fill(0);
        let bestMatchInfo = new Array(sourceEmbedding.sentenceEmbeddings.length).fill(null);

        // For each source sentence, find the best match across all top matches
        sourceEmbedding.sentenceEmbeddings.forEach((sourceSentenceEmb, sourceIndex) => {
            // Compare with sentences from all top matches
            topMatches.forEach(match => {
                match.embedding.sentenceEmbeddings.forEach((targetSentenceEmb, targetIndex) => {
                    const similarity = cosineSimilarity(sourceSentenceEmb, targetSentenceEmb);
                    
                    if (similarity > bestScores[sourceIndex] && 
                        similarity > config.thresholds.sentenceSimilarity) {
                        bestScores[sourceIndex] = similarity;
                        bestMatchInfo[sourceIndex] = {
                            sourceIndex,
                            targetIndex,
                            similarity,
                            expertFeedback: match.embedding.interactionId.expertFeedback,
                            matchId: match.embedding.interactionId._id
                        };
                    }
                earch});
            });
        });

        // Filter out unmatched sentences and format the results
        bestMatchInfo.forEach(info => {
            if (info) {
                bestSentenceMatches.push(info);
            }
        });

        return bestSentenceMatches;
    }

    async findBestCitationMatch(interaction, bestAnswerMatches) {
        const sourceUrl = interaction.answer?.citation?.url || '';
        const bestCitationMatch = {
            score: 100,
            explanation: 'Positive feedback - citation meets requirements',
            url: '',
            similarity: 0
        };

        // Look for exact URL matches in best answer matches
        for (const match of bestAnswerMatches) {
            const expertFeedback = match.embedding.interactionId.expertFeedback;
            const matchUrl = expertFeedback.expertCitationUrl;
            
            if (matchUrl && sourceUrl.toLowerCase() === matchUrl.toLowerCase()) {
                bestCitationMatch.score = expertFeedback.citationScore ?? 100;
                bestCitationMatch.explanation = expertFeedback.citationExplanation || 
                    (expertFeedback.citationScore === 100 ? 
                        'Positive feedback - citation matches expert example' : 
                        'Citation needs improvement');
                bestCitationMatch.url = matchUrl;
                bestCitationMatch.similarity = 1;
                break;
            }
        }

        ServerLoggingService.debug('Citation matching result:', 'system', {
            sourceUrl,
            matchedUrl: bestCitationMatch.url,
            score: bestCitationMatch.score
        });

        return bestCitationMatch;
    }

    computeTotalScore(feedback, sentenceCount) {
        // Check if any ratings were provided at all
        const hasAnyRating = [
            feedback.sentence1Score,
            feedback.sentence2Score,
            feedback.sentence3Score,
            feedback.sentence4Score,
            feedback.citationScore,
        ].some((score) => score !== null);

        // If no ratings were provided at all, return null
        if (!hasAnyRating) return null;

        // Get scores for existing sentences (up to sentenceCount)
        const sentenceScores = [
            feedback.sentence1Score,
            feedback.sentence2Score,
            feedback.sentence3Score,
            feedback.sentence4Score,
        ]
            .slice(0, sentenceCount)
            .map((score) => (score === null ? 100 : score)); // Unrated sentences = 100

        // Calculate sentence component
        const sentenceComponent =
            (sentenceScores.reduce((sum, score) => sum + score, 0) / sentenceScores.length) * 0.75;

        // Citation score defaults to 25 (good) in two cases:
        // 1. Citation exists but wasn't rated
        // 2. Answer has no citation section at all
        const citationComponent = feedback.citationScore !== null ? feedback.citationScore : 25;

        const totalScore = sentenceComponent + citationComponent;

        return Math.round(totalScore * 100) / 100;
    }

    async createEvaluation(interaction, bestMatch, sentenceMatches, chatId, bestCitationMatch) {
        // Get the expert feedback from the best match
        const matchInteraction = bestMatch.embedding.interactionId;

        const expertFeedback = matchInteraction.expertFeedback;
        if (!expertFeedback) {
            ServerLoggingService.warn('No expert feedback found for the matched interaction', chatId, {
                interactionId: matchInteraction._id
            });
            return null;
        }

        // Find the chat for the matched interaction
        const matchedChat = await Chat.findOne({ interactions: matchInteraction._id });
        if (!matchedChat) {
            ServerLoggingService.warn('No chat found for the matched interaction', chatId, {
                interactionId: matchInteraction._id
            });
            return null;
        }

        // Create a new feedback object
        const newExpertFeedback = new ExpertFeedback({
            totalScore: null, // Will be calculated after setting all scores
            citationScore: bestCitationMatch.score,
            citationExplanation: bestCitationMatch.explanation,
            answerImprovement: '',
            expertCitationUrl: bestCitationMatch.url,
            feedback: 'Automated evaluation based on similar responses'
        });

        // Sort sentence matches by target index (order in expert feedback)
        const orderedMatches = [...sentenceMatches].sort((a, b) => a.targetIndex - b.targetIndex);
        
        // Map sentence feedback from expert feedback to new feedback object
        orderedMatches.forEach((match, idx) => {
            const feedbackIdx = match.targetIndex + 1; // Convert to 1-based index for feedback
            const newIdx = idx + 1; // Use sequential index for new feedback

            if (feedbackIdx >= 1 && feedbackIdx <= 4) {
                const score = expertFeedback[`sentence${feedbackIdx}Score`] ?? 100;
                newExpertFeedback[`sentence${newIdx}Score`] = score;
                newExpertFeedback[`sentence${newIdx}Explanation`] = 
                    score === 100 ? 'Positive feedback' : 'Needs improvement';
                newExpertFeedback[`sentence${newIdx}Harmful`] = score < 50;
            }
        });

        // Recalculate the total score based on the new sentence ordering
        const recalculatedScore = this.computeTotalScore(newExpertFeedback, orderedMatches.length);
        newExpertFeedback.totalScore = recalculatedScore;

        const savedFeedback = await newExpertFeedback.save();

        ServerLoggingService.info('Expert feedback saved successfully', chatId, {
            feedbackId: savedFeedback._id,
            totalScore: recalculatedScore,
            citationScore: bestCitationMatch.score
        });

        // Create new evaluation using the matched chat's ID and interaction ID
        const newEval = new Eval({
            chatId: interaction.chatId,
            interactionId: interaction._id,
            expertFeedback: savedFeedback._id,
            similarityScores: {
                question: bestMatch.similarity,
                answer: bestMatch.answerSimilarity,
                questionAnswer: (bestMatch.similarity + bestMatch.answerSimilarity) / 2,
                sentences: orderedMatches.map(match => match.similarity),
                citation: bestCitationMatch.similarity || 0
            }
        });

        const savedEval = await newEval.save();

        // Update the interaction with the new evaluation
        await Interaction.findByIdAndUpdate(
            interaction._id,
            { autoEval: savedEval._id },
            { new: true }
        );

        ServerLoggingService.info('Created evaluation with matched sentence feedback', chatId, {
            evaluationId: savedEval._id,
            feedbackId: savedFeedback._id,
            totalScore: recalculatedScore,
            similarityScores: newEval.similarityScores
        });

        return savedEval;
    }

    async evaluateInteraction(interaction, chatId) {
        await dbConnect();
        try {
            // Validate interaction and check if evaluation already exists
            const validationResult = await this.validateInteractionAndCheckExisting(interaction, chatId);
            if (validationResult !== true) {
                return validationResult; // Returns null or existing eval
            }

            // Get embedding for the current interaction
            const sourceEmbedding = await this.getEmbeddingForInteraction(interaction);
            if (!sourceEmbedding) {
                ServerLoggingService.warn('No embeddings found for interaction', chatId);
                return null;
            }

            // Find similar embeddings with expert feedback
            const similarEmbeddings = await this.findSimilarEmbeddingsWithFeedback(
                sourceEmbedding,
                config.thresholds.questionAnswerSimilarity
            );

            if (!similarEmbeddings.length) {
                ServerLoggingService.info('No similar embeddings with expert feedback found', chatId);
                return null;
            }

            // Find best matching answers based on answer embedding
            const bestAnswerMatches = await this.findBestAnswerMatches(
                sourceEmbedding,
                similarEmbeddings,
                config.searchLimits.topAnswerMatches
            );

            if (!bestAnswerMatches.length) {
                ServerLoggingService.info('No good answer matches found', chatId);
                return null;
            }

            // Find best sentence matches from all top matches
            const bestSentenceMatches = await this.findBestSentenceMatches(
                sourceEmbedding,
                bestAnswerMatches
            );

            if (!bestSentenceMatches.length) {
                ServerLoggingService.info('No good sentence matches found', chatId);
                return null;
            }

            // Find the best citation match
            const bestCitationMatch = await this.findBestCitationMatch(
                interaction,
                bestAnswerMatches
            );

            // Create evaluation using best matches
            return await this.createEvaluation(
                interaction,
                bestAnswerMatches[0], // Use the top answer match for overall similarity
                bestSentenceMatches,
                chatId,
                bestCitationMatch
            );

        } catch (error) {
            ServerLoggingService.error('Error during interaction evaluation', chatId, error);
            return null;
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
     * @param {number} duration - Duration in seconds to process interactions.
     * @param {boolean} skipExisting - Whether to skip interactions that already have evaluations.
     * @param {string} lastProcessedId - The ID of the last processed interaction for pagination.
     * @returns {Object} Results of the processing.
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