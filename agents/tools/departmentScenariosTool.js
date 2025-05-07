import { tool } from "@langchain/core/tools";
import ServerLoggingService from '../../services/ServerLoggingService.js';
import path from 'path'; // Import path module

// Define mappings and potential base path for scenarios
const frenchDepartmentMap = {
  ARC: 'CRA',
  EDSC: 'ESDC',
  SAC: 'ISC',
  CFP: 'PSC',
  IRCC: 'IRCC', // Stays the same
};

// Base path for scenarios, assuming execution relative to project root
const scenarioBasePath = '../../prompts/scenarios/context-specific/'; // Updated path

/**
 * Loads and returns department-specific scenarios.
 * @param {object} input - The input object containing the department abbreviation.
 * @param {string} input.department - The department abbreviation (e.g., CRA, ESDC, ARC, EDSC).
 * @param {object} [input.overrides] - Optional map of filename/content overrides.
 * @returns {Promise<string>} - A promise that resolves to the department-specific scenario string, or an empty string if not found or on error.
 */
export const departmentScenariosLogic = async ({ department, overrides = {} }) => { // Export the logic function
    // Map French abbreviation to English key if necessary, otherwise assume it's English.
    const departmentKey = frenchDepartmentMap[department] || department;

    // Construct the expected module path (adjust if structure changes)
    const filename = `${departmentKey.toLowerCase()}-scenarios.js`;
    const moduleSubPath = `${departmentKey.toLowerCase()}/${filename}`;
    // Construct the path assuming execution from project root
    const modulePath = `${scenarioBasePath}${moduleSubPath}`;

    ServerLoggingService.debug(`Attempting to load scenarios for department key: ${departmentKey} from ${modulePath}`, null); // Use null chatId if not available here

    // Check for override first
    if (overrides && overrides[filename]) {
        ServerLoggingService.debug(`Using override content for ${filename}`, null);
        return overrides[filename];
    }

    // If no override, load from file
    try {
        // Dynamically import the module using the potentially root-relative path
        const module = await import(modulePath);

        // Extract the scenarios content (assuming a consistent export name like DEPT_SCENARIOS)
        const scenariosKey = `${departmentKey}_SCENARIOS`;
        const scenariosContent = module[scenariosKey];

        if (scenariosContent) {
            ServerLoggingService.debug(`Successfully loaded scenarios for ${departmentKey}`, null);
            return scenariosContent;
        } else {
            ServerLoggingService.warn(`Scenarios key ${scenariosKey} not found in module ${modulePath}`, null);
            return ''; // Return empty if the expected export isn't found
        }
    } catch (error) {
        // Handle cases where the module doesn't exist or fails to load
        // Log a warning specifically if the module wasn't found for the given department key
        if (error.code === 'ERR_MODULE_NOT_FOUND') {
            ServerLoggingService.warn(`No specific scenarios module found for department: ${departmentKey} at path: ${modulePath}`, null);
        } else {
            // Log other import errors as errors
            // ADDED LOGGING: Log the actual error code and message
            ServerLoggingService.error(`Error loading scenarios module for department ${departmentKey} from ${modulePath}. Error Code: ${error.code}, Message: ${error.message}`, null, error);
        }
        return ''; // Return empty string on any error
    }
  };

// Export the configuration separately
export const departmentScenariosConfig = {
  name: "departmentScenarios",
  description: "Loads and returns department-specific scenarios based *only* on the provided department abbreviation (e.g., CRA, ESDC, ARC). The tool handles mapping French abbreviations internally and applies user-specific overrides if available. Use this after determining the relevant department to fetch its specific instructions.",
  schema: {
        type: "object",
        properties: {
            department: {
                type: "string",
                description: "The department abbreviation (e.g., CRA, ESDC, ARC, EDSC). This is required."
            }
        },
        required: ["department"]
    },
};

// Note: We no longer export a default tool instance directly from here.
// It will be constructed in the toolFactory.
