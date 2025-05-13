import ServerLoggingService from './ServerLoggingService.js';
import { ROLE } from '../prompts/old/roleAndGoal.js';
import { BASE_SYSTEM_PROMPT } from '../prompts/old/agenticBase.js';
import { CONTEXT_PROMPT } from '../prompts/old/contextSystemPrompt.js';
import { CITATION_INSTRUCTIONS } from '../prompts/old/citationInstructions.js';
import { KEY_GUIDELINES } from '../prompts/old/keyGuidelines.js';
import { SCENARIOS } from '../prompts/old/scenarios-all.js';
import { REMINDERS } from '../prompts/old/reminders.js';


/**
 * Assembles the complete system prompt from modular components.
 */
class PromptBuilderService {

    static getPromptFileOrder() {
        return [
            'roleAndGoal.js',
            'agenticBase.js',
            'workflowSteps.js',
            'contextSystemPrompt.js',
            'citationInstructions.js',
            'keyGuidelines.js',
            'scenarios-all.js',
            'reminders.js',
        ];
    }



    /**
   * Builds the complete system prompt string, using provided overrides if available.
   * @param {string} [language='en'] - The language code ('en' or 'fr').
   * @param {string} [referringUrl=''] - The referring URL from the user's context.
   * @param {object} [overrides={}] - Optional map of filename/content overrides.
   * @returns {Promise<string>} The assembled system prompt.
   */

    static promptContentMap = {
        'roleAndGoal.js': ROLE,
        'agenticBase.js': BASE_SYSTEM_PROMPT,
        'contextSystemPrompt.js': CONTEXT_PROMPT,
        'citationInstructions.js': CITATION_INSTRUCTIONS,
        'keyGuidelines.js': KEY_GUIDELINES,
        'scenarios-all.js': SCENARIOS,
        'reminders.js': REMINDERS
    };

    /**
     * Returns the prompt content for a given filename, using overrides if provided, otherwise the default from promptContentMap.
     * @param {string} filename
     * @param {object} overrides
     * @returns {string}
     */
    static getPromptContent(filename, overrides = {}) {
        if (overrides && overrides[filename]) {
            if (ServerLoggingService?.debug) ServerLoggingService.debug(`Using provided override for prompt: ${filename}`);
            return overrides[filename];
        }
        return PromptBuilderService.promptContentMap[filename] || '';
    }

    async buildPrompt(language = 'en', referringUrl = '', overrides = {}) {
        try {
            

            // Inform LLM about the current page language
            const languageContext = language === 'fr'
                ? "<page-language>French</page-language>"
                : "<page-language>English</page-language>";

            const referringUrlContext = referringUrl ? `### Referring URL: <referring-url>${referringUrl}</referring-url>` : '';

            // Add current date information
            const currentDate = new Date().toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            // Compose the BASE_SYSTEM_PROMPT with possible overrides for its placeholders
            const baseSystemPrompt = PromptBuilderService.getPromptContent('agenticBase.js', overrides)
                .replaceAll('### CONTEXT_PROMPT ###', PromptBuilderService.getPromptContent('contextSystemPrompt.js', overrides))
                .replaceAll('### CITATION INSTRUCTIONS ###', PromptBuilderService.getPromptContent('citationInstructions.js', overrides))
                .replaceAll('### KEY GUIDELINES ###', PromptBuilderService.getPromptContent('keyGuidelines.js', overrides));

            // Compose the full prompt
            const fullPrompt = `
${PromptBuilderService.getPromptContent('roleAndGoal.js', overrides)}
## Current date
Today is ${currentDate}.
## Official language context:
${languageContext}
${referringUrlContext}
${baseSystemPrompt}
${PromptBuilderService.getPromptContent('scenarios-all.js', overrides)}
${PromptBuilderService.getPromptContent('reminders.js', overrides)}
`;

            return fullPrompt.trim();
        } catch (error) {
            await ServerLoggingService.error('system', 'PROMPT BUILDER SERVICE ERROR:', error);
            return `Error assembling full prompt. Proceed with caution.`;
        }
    }
}

export { PromptBuilderService };
// Export a singleton instance
export default new PromptBuilderService();
