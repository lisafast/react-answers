import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatCohere } from '@langchain/cohere';
import OpenAI from 'openai';
import { getModelConfig } from '../config/ai-models.js';
import ServerLoggingService from '../services/ServerLoggingService.js';
import dotenv from 'dotenv';

dotenv.config();

// --- Client Cache ---
const directClientCache = new Map();
const langchainClientCache = new Map();

// === Direct Client Creation (Non-LangChain) ===

export const createDirectOpenAIClient = () => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            ServerLoggingService.warn('OPENAI_API_KEY not found. Cannot create direct OpenAI client.');
            return null;
        }
        const modelConfig = getModelConfig('openai');
        return new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            maxRetries: 3,
            timeout: modelConfig.timeoutMs || 60000,
        });
    } catch (error) {
        ServerLoggingService.error('Error creating direct OpenAI client:', 'system', error);
        return null;
    }
};

export const createDirectAzureOpenAIClient = () => {
    try {
        if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
            ServerLoggingService.warn('Azure OpenAI API Key or Endpoint not found. Cannot create direct Azure OpenAI client.');
            return null;
        }
        const modelConfig = getModelConfig('azure');
        return new OpenAI({
            apiKey: process.env.AZURE_OPENAI_API_KEY,
            baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o-mini'}`,
            defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || '2024-06-01' },
            defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
            maxRetries: 3,
            timeout: modelConfig.timeoutMs || 120000,
        });
    } catch (error) {
        ServerLoggingService.error('Error creating direct Azure OpenAI client:', 'system', error);
        return null;
    }
};

// === LangChain Client Creation ===

export const createLangchainOpenAI = () => {
    if (!process.env.OPENAI_API_KEY) {
        ServerLoggingService.warn('OPENAI_API_KEY not found. Cannot create Langchain OpenAI client.');
        return null;
    }
    const modelConfig = getModelConfig('openai');
    return new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: modelConfig.name,
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens,
        timeout: modelConfig.timeoutMs,
    });
};

export const createLangchainAzure = () => {
    if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
        ServerLoggingService.warn('Azure OpenAI API Key or Endpoint not found. Cannot create Langchain Azure OpenAI client.');
        return null;
    }
    const modelConfig = getModelConfig('azure');
    return new AzureChatOpenAI({
        azureApiKey: process.env.AZURE_OPENAI_API_KEY,
        azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-06-01',
        azureOpenAIApiDeploymentName: modelConfig.name,
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens,
        timeout: modelConfig.timeoutMs,
    });
};

export const createLangchainCohere = () => {
    if (!process.env.REACT_APP_COHERE_API_KEY) {
        ServerLoggingService.warn('REACT_APP_COHERE_API_KEY not found. Cannot create Langchain Cohere client.');
        return null;
    }
    const modelConfig = getModelConfig('cohere');
    try {
        return new ChatCohere({
            apiKey: process.env.REACT_APP_COHERE_API_KEY,
            model: modelConfig.name,
            temperature: modelConfig.temperature,
            maxTokens: modelConfig.maxTokens,
        });
    } catch (error) {
        ServerLoggingService.error('Error creating Langchain Cohere client:', 'system', error);
        return null;
    }
};

export const createLangchainAnthropic = () => {
    if (!process.env.REACT_APP_ANTHROPIC_API_KEY) {
        ServerLoggingService.warn('REACT_APP_ANTHROPIC_API_KEY not found. Cannot create Langchain Anthropic client.');
        return null;
    }
    const modelConfig = getModelConfig('anthropic');
    try {
        return new ChatAnthropic({
            apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
            modelName: modelConfig.name,
            temperature: modelConfig.temperature,
            maxTokens: modelConfig.maxTokens,
        });
    } catch (error) {
        ServerLoggingService.error('Error creating Langchain Anthropic client:', 'system', error);
        return null;
    }
};

// Factory function to get a LangChain client by type
export const getLangchainClient = (llmType) => {
    // Check cache first
    if (langchainClientCache.has(llmType)) {
        return langchainClientCache.get(llmType);
    }

    let client = null;
    switch (llmType) {
        case 'openai':
            client = createLangchainOpenAI();
            break;
        case 'azure':
            client = createLangchainAzure();
            break;
        case 'cohere':
            client = createLangchainCohere();
            break;
        case 'anthropic':
        case 'claude':
            client = createLangchainAnthropic();
            break;
        default:
            ServerLoggingService.error(`Unknown LangChain LLM type: ${llmType}`);
            return null;
    }

    // Cache the client if it was successfully created
    if (client) {
        langchainClientCache.set(llmType, client);
    }
    
    return client;
};

// Get a direct client with caching
export const getDirectClient = (clientType) => {
    // Check cache first
    if (directClientCache.has(clientType)) {
        return directClientCache.get(clientType);
    }

    let client = null;
    switch (clientType) {
        case 'openai':
            client = createDirectOpenAIClient();
            break;
        case 'azure':
            client = createDirectAzureOpenAIClient();
            break;
        default:
            ServerLoggingService.error(`Unknown direct client type: ${clientType}`);
            return null;
    }

    // Cache the client if it was successfully created
    if (client) {
        directClientCache.set(clientType, client);
    }
    
    return client;
};
