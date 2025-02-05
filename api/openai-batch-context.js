import OpenAI from 'openai';
import { getModelConfig } from '../config/ai-models.js';
import dbConnect from './db-connect.js';
import { Batch } from '../models/batch.js';
import { Interaction } from '../models/interaction.js';
import { Context } from '../models/context.js';
import { Question } from '../models/question.js';



const modelConfig = getModelConfig('openai', 'gpt-4o-mini');
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('Context Batch API request received:', {
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
                        content: request.systemPrompt + "<searchResults>" + request.searchResults.results + "</searchResults>",
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

        // Convert to JSONL format
        let jsonlContent = jsonlRequests
            .map(req => JSON.stringify(req))
            .join('\n');

        // Log the size of the JSONL content
        console.log('Size of JSONL content:', Buffer.byteLength(jsonlContent, 'utf8'), 'bytes');



        const jsonlBuffer = Buffer.from(jsonlContent, 'utf-8');

        const jsonlBlob = new Blob([jsonlBuffer], { type: 'application/jsonl' });

        const formData = new FormData();
        formData.append('file', jsonlBlob, 'data.jsonl'); // Filename is important

        formData.append('purpose', 'batch');

        const file = await fetch('https://api.openai.com/v1/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: formData,
        });
        const fileData = await file.json();
        console.log('File created with ID:', fileData.id);

        // Create the batch using the file
        const openAIBatch = await openai.batches.create({
            input_file_id: fileData.id,
            endpoint: "/v1/chat/completions",
            completion_window: "24h"
        });
        console.log('Batch created with ID:', openAIBatch.id);



        console.log('Context Batch created successfully:', {
            batchId: openAIBatch.id,
            status: openAIBatch.status,
            model: modelConfig.name
        });

        // save the batch id and entries
        await dbConnect();
        const savedBatch = new Batch({
            batchId: openAIBatch.id,
            type: "context",
            aiProvider: "openai",
            pageLanguage: req.body.lang,
            referringUrl: req.body.referringUrl,
            name: req.body.batchName

        });
        await savedBatch.save();
        for (const [index, request] of req.body.requests.entries()) {
            const context = new Context({
                searchProvider: request.searchResults.provider,
                searchResults: request.searchResults.results,  // Convert to string as per schema
            });
            await context.save();

            // Create Question document
            const question = new Question({
                redactedQuestion: request.message
            });
            await question.save();

            // Create Interaction with references
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
        return res.status(200).json({
            batchId: openAIBatch.id,
            status: openAIBatch.status
        });

    } catch (error) {
        console.error('Context Batch API error:', {
            message: error.message,
            type: error.constructor.name,
            stack: error.stack
        });
        return res.status(500).json({
            error: 'Failed to create batch',
            details: error.message
        });
    }
} 