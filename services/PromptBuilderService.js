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
import { SCENARIOS as GENERAL_SCENARIOS } from '../prompts/scenarios/scenarios-all.js';
import LoggingService from './ServerLoggingService.js';

/**
 * Assembles the complete system prompt from modular components.
 */
class PromptBuilderService {

  /**
   * Builds the complete system prompt string.
   * @param {string} [language='en'] - The language code ('en' or 'fr').
   * @param {string} [referringUrl=''] - The referring URL from the user's context.
   * @returns {Promise<string>} The assembled system prompt.
   */
  async buildPrompt(language = 'en', referringUrl = '') {
    try {
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
      // Order matters for LLM processing.
      const promptSections = [
        ROLE_AND_GOAL,
        dynamicContext, // Place dynamic context early
        AVAILABLE_TOOLS,
        WORKFLOW_STEPS,
        PRELIMINARY_CHECKS_INSTRUCTIONS,
        DEPARTMENT_MATCHING_INSTRUCTIONS,
        DEPARTMENT_SCENARIOS_INSTRUCTIONS,
        ANSWER_CONTEXT_INSTRUCTIONS,
        ANSWER_CRAFTING_INSTRUCTIONS,
        TRANSLATION_INSTRUCTIONS,
        CITATION_INSTRUCTIONS,
        FORMAT_VERIFICATION_INSTRUCTIONS,
        GENERAL_SCENARIOS, // General scenarios before key guidelines
        KEY_GUIDELINES,
        "\nReminder: Follow all steps and guidelines meticulously. Accuracy, adherence to format, and appropriate tool usage are critical." // Final reminder
      ];

      const fullPrompt = promptSections.join('\n\n'); // Join sections with double newline for readability

      ServerLoggingService.info('System prompt assembled successfully', null, { language, promptLength: fullPrompt.length });
      return fullPrompt.trim();

    } catch (error) {
      await LoggingService.error('system', 'PROMPT BUILDER SERVICE ERROR:', error);
      // Fallback to a minimal prompt structure in case of error
      // Consider if a more robust fallback is needed
      return `${ROLE_AND_GOAL}\n${KEY_GUIDELINES}\nError assembling full prompt. Proceed with caution.`;
    }
  }
}

// Export a singleton instance
export default new PromptBuilderService();
