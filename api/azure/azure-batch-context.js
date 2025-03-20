import { getModelConfig } from '../../config/ai-models.js';
import dbConnect from '../../api/db/db-connect.js';
import { Batch } from '../../models/batch.js';
import { Interaction } from '../../models/interaction.js';
import { Context } from '../../models/context.js';
import { Question } from '../../models/question.js';
import { createDirectAzureOpenAIClient } from '../../agents/AgentService.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';

const modelConfig = getModelConfig('azure', 'gpt4a-mini');
const openai = createDirectAzureOpenAIClient();

async function batchContextHandler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('Azure Context Batch API request received:', {
            requestCount: req.body.requests?.length
        });

        if (!req.body.requests || !Array.isArray(req.body.requests)) {
            throw new Error('Invalid requests array in payload');
        }

        const jsonlRequests = req.body.requests.map((request, index) => ({
            custom_id: `batch-${index}`,
            method: "POST",
            url: "/v1/chat/completions",
            body: {
                model: modelConfig.name,
                messages: [
                    {
                        role: "system",
                        content: `${request.systemPrompt}<searchResults>${request.searchResults.results}</searchResults>`,
                    },
                    {
                        role: "user",
                        content: request.message
                    }
                ],
                max_tokens: modelConfig.maxTokens,
                temperature: modelConfig.temperature
            }
        }));

        const openAIBatch = await openai.batches.create(jsonlRequests);

        // Save to database
        await dbConnect();
        const savedBatch = new Batch({
            batchId: openAIBatch.id,
            type: "context",
            aiProvider: "azure",
            pageLanguage: req.body.lang,
            name: req.body.batchName
        });

        for (const [index, request] of req.body.requests.entries()) {
            const context = new Context({
                searchResults: request.searchResults,
                searchProvider: request.searchProvider
            });
            await context.save();

            const question = new Question({
                redactedQuestion: request.message
            });
            await question.save();

            let interaction = new Interaction({
                interactionId: `batch-${index}`,
                question: question._id,
                context: context._id
            });
            await interaction.save();
            savedBatch.interactions.push(interaction._id);
        }

        await savedBatch.save();
        return res.status(200).json({ batchId: openAIBatch.id });

    } catch (error) {
        console.error('Error creating context batch:', error);
        return res.status(500).json({ 
            error: error.message,
            details: error.response?.data || 'No additional details available'
        });
    }
}

export default function handler(req, res) {
    return withProtection(batchContextHandler, authMiddleware, adminMiddleware)(req, res);
}