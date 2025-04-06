import { ROLE_AND_GOAL } from '../prompts/base/roleAndGoal.js';
import { AVAILABLE_TOOLS } from '../prompts/base/availableTools.js';
import { WORKFLOW_STEPS } from '../prompts/base/workflowSteps.js';
import { PRELIMINARY_CHECKS_INSTRUCTIONS } from '../prompts/base/preliminaryChecksInstructions.js';
import { DEPARTMENT_MATCHING_INSTRUCTIONS } from '../prompts/base/departmentMatchingInstructions.js';
import { DEPARTMENT_SCENARIOS_INSTRUCTIONS } from '../prompts/base/departmentScenariosInstructions.js';
import { ANSWER_CONTEXT_INSTRUCTIONS } from '../prompts/base/answerContextInstructions.js';
import { ANSWER_CRAFTING_INSTRUCTIONS } from '../prompts/base/answerCraftingInstructions.js';
import { TRANSLATION_INSTRUCTIONS } from '../prompts/base/translationInstructions.js';
import { CITATION_INSTRUCTIONS } from '../prompts/base/citationInstructions.js';
import { FORMAT_VERIFICATION_INSTRUCTIONS } from '../prompts/base/formatVerificationInstructions.js';
import { KEY_GUIDELINES } from '../prompts/base/keyGuidelines.js';
// Import individual scenario files instead of the combined one if needed for overrides
// import { SCENARIOS as GENERAL_SCENARIOS } from '../prompts/scenarios/scenarios-all.js';
import DataStoreService from './DataStoreService.js'; // Added for DB access
import PromptDiscoveryService from './PromptDiscoveryService.js'; // Added for path lookup
import ServerLoggingService from './ServerLoggingService.js'; // Renamed import alias
import fs from 'fs/promises'; // Needed to read default files

/**
 * Assembles the complete system prompt from modular components.
 */
class PromptBuilderService {

  /**
 * Builds the complete system prompt string, potentially using user-specific overrides.
 * @param {string} [language='en'] - The language code ('en' or 'fr').
 * @param {string} [referringUrl=''] - The referring URL from the user's context.
 * @param {string|null} [overrideUserId=null] - The ID of the admin user whose overrides should be checked.
 * @returns {Promise<string>} The assembled system prompt.
 */
  async buildPrompt(language = 'en', referringUrl = '', overrideUserId = null) {
    try {
      // Helper function to get prompt content (override or default)
      const getPromptContent = async (filename, defaultExportedContent) => {
        if (overrideUserId) {
          const override = await DataStoreService.getPromptOverride(overrideUserId, filename);
          if (override) {
            ServerLoggingService.debug(`Using DB override for prompt: ${filename}`, null, { overrideUserId });
            return override.content;
          }
        }
        // No active override, try reading default file content
        // This assumes the defaultExportedContent is the actual content string.
        // If it's an object/module, adjust logic.
        // A more robust way might be to read from file path if defaultExportedContent isn't the raw string.
        // For now, assume the import gives the string content directly.
        // ServerLoggingService.debug(`Using default content for prompt: ${filename}`);
        return defaultExportedContent; // Return the imported default
      };


      // --- Dynamic Context ---
      const currentDate = new Date().toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      const languageContext = language === 'fr'
        ? "<page-language>French</page-language>"
        : "<page-language>English</page-language>";
      const referringUrlContext = `<referring-url>\${referringUrl || 'Not provided'}</referring-url>`;
      const dynamicContext = `
## Current date
Today is ${currentDate}.

## Context for this request
${languageContext}
${referringUrlContext}
`;

      // --- Assemble Prompt Modules ---
      // Fetch content for each section, checking for overrides
      const sectionsContent = await Promise.all([
        getPromptContent('roleAndGoal.js', ROLE_AND_GOAL),
        Promise.resolve(dynamicContext), // Dynamic context isn't overridden
        getPromptContent('availableTools.js', AVAILABLE_TOOLS),
        getPromptContent('workflowSteps.js', WORKFLOW_STEPS),
        getPromptContent('preliminaryChecksInstructions.js', PRELIMINARY_CHECKS_INSTRUCTIONS),
        getPromptContent('departmentMatchingInstructions.js', DEPARTMENT_MATCHING_INSTRUCTIONS),
        getPromptContent('departmentScenariosInstructions.js', DEPARTMENT_SCENARIOS_INSTRUCTIONS),
        getPromptContent('answerContextInstructions.js', ANSWER_CONTEXT_INSTRUCTIONS),
        getPromptContent('answerCraftingInstructions.js', ANSWER_CRAFTING_INSTRUCTIONS),
        getPromptContent('translationInstructions.js', TRANSLATION_INSTRUCTIONS),
        getPromptContent('citationInstructions.js', CITATION_INSTRUCTIONS),
        getPromptContent('formatVerificationInstructions.js', FORMAT_VERIFICATION_INSTRUCTIONS),
        // TODO: Handle scenarios - might need separate logic if they aren't simple string exports
        // For now, assume GENERAL_SCENARIOS is the default content string for 'scenarios-all.js'
        // getPromptContent('scenarios-all.js', GENERAL_SCENARIOS),
        getPromptContent('keyGuidelines.js', KEY_GUIDELINES),
        Promise.resolve("\nReminder: Follow all steps and guidelines meticulously. Accuracy, adherence to format, and appropriate tool usage are critical.") // Final reminder isn't overridden
      ]);

      // Filter out any null/undefined sections if fetching failed (though getPromptContent should return default)
      const validSectionsContent = sectionsContent.filter(content => typeof content === 'string');

      const fullPrompt = validSectionsContent.join('\n\n'); // Join sections with double newline

      ServerLoggingService.info('System prompt assembled successfully', null, { language, overrideUserId: overrideUserId || 'none', promptLength: fullPrompt.length });
      return fullPrompt.trim();

    } catch (error) {
      await ServerLoggingService.error('system', 'PROMPT BUILDER SERVICE ERROR:', error);
      // Fallback to a minimal prompt structure in case of error
      // Consider if a more robust fallback is needed
      return `${ROLE_AND_GOAL}\n${KEY_GUIDELINES}\nError assembling full prompt. Proceed with caution.`;
    }
  }
}

// Export a singleton instance
export default new PromptBuilderService();
