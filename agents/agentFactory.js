import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getLangchainClient } from '../llm/clientFactory.js';
import { getStandardTools } from './toolFactory.js'; // Removed getContextSearchTool import

// Removed ToolTrackingHandler import
import ServerLoggingService from '../services/ServerLoggingService.js';



/**
 * Creates a LangChain React Agent with the specified LLM and tools.
 * @param {string} llmType - The type of LLM ('openai', 'azure', 'cohere', 'anthropic').
 * @param {Array<object>} tools - Array of *unwrapped* tools.
 * @param {string} chatId - The chat ID for context/tracking (used for logging here).
 * @returns {Promise<object|null>} The created agent or null if LLM client fails.
 */
const createGenericAgent = async (llmType, tools, chatId) => { // Keep chatId for logging
    // Get cached or create new LLM client - lazy loaded
    const llm = getLangchainClient(llmType);
    if (!llm) {
        ServerLoggingService.error(`Failed to create LLM client for type: ${llmType}`, chatId);
        return null;
    }

    // Removed callback extraction from tools

    try {
        // Create agent without attaching callbacks here
        const agent = await createReactAgent({ llm, tools });
        // agent.callbacks = callbacks; // Removed
        return agent;
    } catch (error) {
        ServerLoggingService.error(`Error creating React agent for ${llmType}:`, chatId, error); // Keep chatId for logging
        return null;
    }
};

// --- Specific Agent Creation Functions ---

/**
 * Creates a standard messaging agent (uses standard tools).
 * @param {string} agentType - The type of LLM ('openai', 'azure', 'anthropic', etc.).
 * @param {string} chatId - The chat ID for context/tracking.
 * @param {string} selectedSearch - The search provider ('google', 'canadaca').
 * @param {object} [overrides={}] - Optional overrides for tool parameters.
 * @returns {Promise<object|null>} The created agent or null if creation fails.
 */
export const createMessageAgent = async (agentType, chatId = 'system', selectedSearch = 'google', overrides = {}) => { // Added overrides parameter
    

    // Pass selectedSearch and overrides to getStandardTools - tools are now unwrapped
    const standardTools = getStandardTools(chatId, agentType, selectedSearch, overrides); // Pass agentType as aiProvider // Added overrides
    if (!standardTools || standardTools.length === 0) {
        ServerLoggingService.warn(`No standard tools found for chatId: ${chatId} and search: ${selectedSearch}. Agent might lack capabilities.`, chatId);
    }

    // Pass unwrapped tools to createGenericAgent
    const agent = await createGenericAgent(agentType, standardTools || [], chatId);

   
    return agent;
};



// --- Agent Selection and Retrieval ---

/**
 * Retrieves an agent from the cache or creates a new one if it doesn't exist.
 * @param {string} selectedAgent - The type of agent ('openai', 'azure', 'anthropic', 'claude').
 * @param {string} selectedSearch - The search provider ('google', 'canadaca').
 * @param {string} chatId - The chat ID for context/tracking.
 * @param {object} [overrides={}] - Optional overrides for tool parameters.
 * @returns {Promise<object|null>} The agent or null if creation fails.
 */
export const getAgent = async (selectedAgent, selectedSearch, chatId = 'system', overrides = {}) => { // Added overrides parameter
    switch (selectedAgent?.toLowerCase()) {
        case 'openai':
        case 'azure':
        case 'anthropic':
        case 'claude':
            // Pass selectedSearch and overrides to createMessageAgent
            return createMessageAgent(selectedAgent, chatId, selectedSearch, overrides); // Added overrides
        // Removed 'context' case
        default:
            ServerLoggingService.error(`Invalid agent specified: ${selectedAgent}`, chatId);
            return null;
    }
};
