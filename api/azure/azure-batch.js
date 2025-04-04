import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';
import { createDirectAzureOpenAIClient } from '../../llm/clientFactory.js';
import { getModelConfig } from '../../config/ai-models.js';
import { Batch } from '../../models/batch.js';
import dbConnect from '../../api/db/db-connect.js';

const MAX_JSONL_SIZE = 50000000; // Set a size limit for JSONL content

async function batchHandler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const openai = createDirectAzureOpenAIClient();
        
        console.log('Azure Batch API request received:', {
            requestCount: req.body.requests?.length,
            systemPromptPresent: !!req.body.requests?.[0]?.systemPrompt,
            firstRequestSample: req.body.requests?.[0]?.message.substring(0, 100)
        });

        // ...existing code for processing batch requests...
        const jsonlRequests = req.body.requests.map((request, index) => ({
            custom_id: `batch-${index}`,
            method: "POST",
            url: "/v1/chat/completions",
            body: {
                model: modelConfig.name,
                messages: [
                    {
                        role: "system",
                        content: request.systemPrompt
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

        // Create batch in Azure OpenAI
        const batch = await openai.batches.create(jsonlRequests);

        // Save to database
        await dbConnect();
        const savedBatch = new Batch({
            name: req.body.batchName,
            batchId: batch.id,
            type: "question",
            aiProvider: "azure",
            pageLanguage: req.body.lang,
            referringUrl: req.body.referringUrl,
        });

        for (const [index, request] of req.body.requests.entries()) {
            const context = new Context({
                ...request.context,
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

            // Add interaction reference to batch
            savedBatch.interactions.push(interaction._id);
        }
        await savedBatch.save();
        console.log('Batch saved:', savedBatch);

        return res.status(200).json({ batchId: batch.id });
    } catch (error) {
        console.error('GPT Batch creation error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            headers: error.response?.headers,
            stack: error.stack
        });
        return res.status(500).json({
            error: error.message,
            details: error.response?.data || 'No additional details available'
        });
    }
}

export default function handler(req, res) {
    return withProtection(batchHandler, authMiddleware, adminMiddleware)(req, res);
}