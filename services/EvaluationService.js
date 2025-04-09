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
                });
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
        // Ensure the citation is populated from the Answer model
        await interaction.populate({
            path: 'answer',
            populate: {
                path: 'citation',
                model: 'Citation'
            }
        });
        const sourceUrl = interaction.answer?.citation?.providedCitationUrl || '';
        const bestCitationMatch = {
            score: null,
            explanation: '',
            url: '',
            similarity: 0
        };

        // Look for exact URL matches in best answer matches
        for (const match of bestAnswerMatches) {
            const expertFeedback = match.embedding.interactionId.expertFeedback;
            const matchInteraction = await Interaction.findById(match.embedding.interactionId._id).populate({
                path: 'answer',
                populate: {
                    path: 'citation',
                    model: 'Citation'
                }
            });
            
            const matchUrl = matchInteraction?.answer?.citation?.providedCitationUrl;
            if (matchUrl && sourceUrl.toLowerCase() === matchUrl.toLowerCase()) {
                bestCitationMatch.score = expertFeedback.citationScore;
                bestCitationMatch.explanation = expertFeedback.citationExplanation;
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

    async createEvaluation(interaction, sentenceMatches, chatId, bestCitationMatch) {
        // Ensure the source interaction's answer and sentences are populated
        const sourceInteraction = await Interaction.findById(interaction._id)
            .populate({
                path: 'answer',
                populate: { path: 'sentences' }
            });

        // Create a new feedback object
         const newExpertFeedback = new ExpertFeedback({
            totalScore: null,
            citationScore: bestCitationMatch.score,
            citationExplanation: bestCitationMatch.explanation,
            answerImprovement: '',
            expertCitationUrl: bestCitationMatch.url,
            feedback: ''
        });

        const sentenceTrace = [];
        const sentenceSimilarities = [];

        // Map sentence feedback and build trace with actual sentence text
        for (const match of sentenceMatches) {
            const feedbackIdx = match.targetIndex + 1;
            const newIdx = sentenceTrace.length + 1;

            // Get source sentence text
            const sourceSentenceText = sourceInteraction?.answer?.sentences[match.sourceIndex];
            
            // Get matched sentence text
            const matchedInteraction = await Interaction.findById(match.matchId)
                .populate({
                    path: 'answer',
                    populate: { path: 'sentences' }
                });
            const matchedSentenceText = matchedInteraction?.answer?.sentences[match.targetIndex];
            

            // Get expert feedback
            if (match.expertFeedback && feedbackIdx >= 1 && feedbackIdx <= 4) {
                const score = match.expertFeedback[`sentence${feedbackIdx}Score`] ?? 100;
                newExpertFeedback[`sentence${newIdx}Score`] = score;
                newExpertFeedback[`sentence${newIdx}Explanation`] = match.expertFeedback[`sentence${feedbackIdx}Explanation`];
                newExpertFeedback[`sentence${newIdx}Harmful`] = match.expertFeedback[`sentence${feedbackIdx}Harmful`] || false;
            }

            // Build trace entry with text
            sentenceTrace.push({
                sourceIndex: match.sourceIndex,
                sourceSentenceText: sourceSentenceText,
                matchedInteractionId: match.matchId,
                matchedSentenceIndex: match.targetIndex,
                matchedSentenceText: matchedSentenceText,
                matchedExpertFeedbackSentenceScore: match.expertFeedback?.[`sentence${feedbackIdx}Score`] ?? 100,
                matchedExpertFeedbackSentenceExplanation: match.expertFeedback?.[`sentence${feedbackIdx}Explanation`],
                similarity: match.similarity
            });

            sentenceSimilarities.push(match.similarity);
        }

        

        // Recalculate the total score based on the sentence scores and citation
        const recalculatedScore = this.computeTotalScore(newExpertFeedback, sentenceMatches.length);
        newExpertFeedback.totalScore = recalculatedScore;
        
        // Set feedback based on totalScore
         if (newExpertFeedback.totalScore === 100) {
            newExpertFeedback.feedback = "positive";
        } else if (newExpertFeedback.totalScore < 100) {
            newExpertFeedback.feedback = "negative";
        }

        const savedFeedback = await newExpertFeedback.save();

        ServerLoggingService.info('Expert feedback saved successfully', chatId, {
            feedbackId: savedFeedback._id,
            totalScore: recalculatedScore,
            citationScore: bestCitationMatch.score
        });

        // Create new evaluation using sentence-level evaluation data
        const newEval = new Eval({
            expertFeedback: savedFeedback._id,
            similarityScores: {
                sentences: sentenceSimilarities,
                citation: bestCitationMatch.similarity || 0
            },
            sentenceMatchTrace: sentenceTrace
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
            similarityScores: newEval.similarityScores,
            traceCount: sentenceTrace.length
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

            if (!bestSentenceMatches.length || bestSentenceMatches.length !== sourceEmbedding.sentenceEmbeddings.length) {
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