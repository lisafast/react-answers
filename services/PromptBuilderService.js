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
import { SCENARIOS } from '../prompts/base/scenarios-all.js';
import DataStoreService from './DataStoreService.js'; // Added for DB access
import PromptDiscoveryService from './PromptDiscoveryService.js'; // Added for path lookup
import ServerLoggingService from './ServerLoggingService.js'; // Renamed import alias
import fs from 'fs/promises'; // Needed to read default files

/**
 * Assembles the complete system prompt from modular components.
 */
class PromptBuilderService {

  static getPromptFileOrder() {
    return [
      'roleAndGoal.js',
      'availableTools.js',
      'workflowSteps.js',
      'preliminaryChecksInstructions.js',
      'departmentMatchingInstructions.js',
      'departmentScenariosInstructions.js',
      'scenarios-all.js',
      'answerContextInstructions.js',
      'answerCraftingInstructions.js',
      'translationInstructions.js',
      'citationInstructions.js',
      'formatVerificationInstructions.js',
      'keyGuidelines.js'
    ];
  }

  /**
 * Builds the complete system prompt string, using provided overrides if available.
 * @param {string} [language='en'] - The language code ('en' or 'fr').
 * @param {string} [referringUrl=''] - The referring URL from the user's context.
 * @param {object} [overrides={}] - Optional map of filename/content overrides.
 * @returns {Promise<string>} The assembled system prompt.
 */
  async buildPrompt(language = 'en', referringUrl = '', overrides = {}) {
    try {
      // Helper function to get prompt content (override or default)
      const getPromptContent = async (filename, defaultExportedContent) => {
        // Check if an override exists in the provided map
        if (overrides && overrides[filename]) {
            ServerLoggingService.debug(`Using provided override for prompt: ${filename}`);
            return overrides[filename];
        }

        // No override provided, use the default content
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
      const referringUrlContext = `<referring-url>${referringUrl || 'Not provided'}</referring-url>`;
      const dynamicContext = `
## Current date
Today is ${currentDate}.

## Context for this request
${languageContext}
${referringUrlContext}
`;

      // --- Assemble Prompt Modules ---
      // Map filenames to their imported content
      const promptContentMap = {
        'roleAndGoal.js': ROLE_AND_GOAL,
        'availableTools.js': AVAILABLE_TOOLS,
        'workflowSteps.js': WORKFLOW_STEPS,
        'preliminaryChecksInstructions.js': PRELIMINARY_CHECKS_INSTRUCTIONS,
        'departmentMatchingInstructions.js': DEPARTMENT_MATCHING_INSTRUCTIONS,
        'departmentScenariosInstructions.js': DEPARTMENT_SCENARIOS_INSTRUCTIONS,
        'scenarios-all.js': SCENARIOS,
        'answerContextInstructions.js': ANSWER_CONTEXT_INSTRUCTIONS,
        'answerCraftingInstructions.js': ANSWER_CRAFTING_INSTRUCTIONS,
        'translationInstructions.js': TRANSLATION_INSTRUCTIONS,
        'citationInstructions.js': CITATION_INSTRUCTIONS,
        'formatVerificationInstructions.js': FORMAT_VERIFICATION_INSTRUCTIONS,
        'keyGuidelines.js': KEY_GUIDELINES
      };

      // Build the sectionsContent array dynamically using the static order
      const fileOrder = PromptBuilderService.getPromptFileOrder();
      const sectionsContent = await Promise.all([
        getPromptContent(fileOrder[0], promptContentMap[fileOrder[0]]),
        Promise.resolve(dynamicContext), // Dynamic context always second
        ...fileOrder.slice(1).map(filename => getPromptContent(filename, promptContentMap[filename])),
        Promise.resolve("\nReminder: Follow all steps and guidelines meticulously. Accuracy, adherence to format, and appropriate tool usage are critical.")
      ]);

      // Filter out any null/undefined sections if fetching failed (though getPromptContent should return default)
      const validSectionsContent = sectionsContent.filter(content => typeof content === 'string');

      const fullPrompt = validSectionsContent.join('\n\n'); // Join sections with double newline

      ServerLoggingService.info('System prompt assembled successfully', null, { language, overrideProvided: Object.keys(overrides).length > 0, promptLength: fullPrompt.length });
      return fullPrompt.trim();

    } catch (error) {
      await ServerLoggingService.error('system', 'PROMPT BUILDER SERVICE ERROR:', error);
      // Fallback to a minimal prompt structure in case of error
      // Consider if a more robust fallback is needed
      return `${ROLE_AND_GOAL}\n${KEY_GUIDELINES}\nError assembling full prompt. Proceed with caution.`;
    }
  }
}

export { PromptBuilderService };
// Export a singleton instance
export default new PromptBuilderService();
