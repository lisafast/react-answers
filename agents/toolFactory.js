import downloadWebPage from './tools/downloadWebPage.js';
import checkUrlStatusTool from './tools/checkURL.js';
// import { ContextTool } from './tools/ContextTool.js'; // Removed LLM-based context tool
import departmentScenarios from './tools/departmentScenariosTool.js'; // Renamed and default import
import departmentLookup from './tools/departmentLookupTool.js'; // Corrected casing and name
import verifyOutputFormat from './tools/verifyOutputFormatTool.js'; // Changed to default import and name
const { googleContextSearch } = await import('./tools/googleContextSearch.js'); // Adjusted import structure
const { contextSearchTool: canadaCaContextSearchTool } = await import('./tools/canadaCaContextSearch.js'); // Keep this as is for now, assuming canadaCaContextSearch.js exports contextSearchTool
// Removed ToolTrackingHandler import
import ServerLoggingService from '../services/ServerLoggingService.js';

// Removed wrapToolWithTracking helper function

// Function to get the standard set of tools (unwrapped)
// Update signature to accept aiProvider and selectedSearch
export const getStandardTools = (chatId = 'system', aiProvider, selectedSearch = 'google') => { // Default to google if not provided
    if (!aiProvider) {
        ServerLoggingService.warn('aiProvider not provided to getStandardTools, ContextTool might fail.', chatId);
        // Consider throwing an error or setting a default if appropriate
        // throw new Error('aiProvider is required for getStandardTools');
    }

    // Define the base toolset for the main agent
    // Note: verifyOutputFormat is now imported directly, no instantiation needed.
    const toolDefinitions = [
        downloadWebPage,
        checkUrlStatusTool, // Assuming this one is correct or out of scope
        departmentScenarios, // Use imported tool directly
        departmentLookup, // Use imported tool directly
        verifyOutputFormat // Use imported tool directly
        // contextToolInstance removed
    ];

    // Conditionally add the correct search tool
    let searchTool;
    switch (selectedSearch?.toLowerCase()) { // Add safe navigation and lowercase check
        case 'google':
            searchTool = googleContextSearch; // Use updated variable name
            break;
        case 'canadaca':
            searchTool = canadaCaContextSearchTool; // Keep this as is for now
            break;
        default:
            ServerLoggingService.warn(`Unknown or unspecified search provider: ${selectedSearch}. Defaulting to Google search.`, chatId);
            searchTool = googleContextSearch; // Default to Google (updated variable)
    }

    if (searchTool) {
        // IMPORTANT: Ensure the selected search tool is provided to the agent
        // under the generic name 'contextSearch' as expected by the prompts.
        // We assume the imported tool objects have a 'name' property that can be modified.
        // If the tool objects are immutable or structured differently, this might need adjustment.
        try {
            searchTool.name = "contextSearch";
            toolDefinitions.push(searchTool);
            ServerLoggingService.debug(`Added search tool under the name 'contextSearch'`, chatId, { originalName: selectedSearch === 'google' ? 'googleContextSearch' : 'canadaCaContextSearchTool' });
        } catch (e) {
            ServerLoggingService.error(`Failed to rename search tool to 'contextSearch'. Tool object might be immutable or lack 'name' property.`, chatId, { error: e.message });
            // Decide how to handle this - maybe push the original tool? Or throw?
            // Pushing original for now, but prompts might fail.
            toolDefinitions.push(searchTool); // Fallback: push original, prompts might not work
        }
    } else {
         ServerLoggingService.error(`Search tool could not be determined for provider: ${selectedSearch}`, chatId);
         // Decide if you want to proceed without a search tool or throw an error
    }

    // Return the raw tool definitions
    return toolDefinitions;
};

// Removed getContextSearchTool as its logic is now integrated into getStandardTools
