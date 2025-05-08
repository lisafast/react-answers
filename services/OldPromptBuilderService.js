import ServerLoggingService from './ServerLoggingService.js';
import { CITATION_INSTRUCTIONS } from '../prompts/old/citationInstructions.js';
import { BASE_SYSTEM_PROMPT } from '../prompts/old/agenticBase.js';
import { CONTEXT_PROMPT } from '../prompts/old/contextSystemPrompt.js';
import { ROLE } from '../prompts/old/roleAndGoal.js';
import { AVAILABLE_TOOLS } from '../prompts/old/availableTools.js';
import { SCENARIOS } from '../prompts/old/scenarios-all.js';
/**
 * Assembles the complete system prompt from modular components.
 */
class PromptBuilderService {



    /**
   * Builds the complete system prompt string, using provided overrides if available.
   * @param {string} [language='en'] - The language code ('en' or 'fr').
   * @param {string} [referringUrl=''] - The referring URL from the user's context.
   * @param {object} [overrides={}] - Optional map of filename/content overrides.
   * @returns {Promise<string>} The assembled system prompt.
   */
    async buildPrompt(language = 'en', referringUrl = '', overrides = {}) {
        try {
            const citationInstructions = CITATION_INSTRUCTIONS;

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

            // add context from contextService call into systme prompt
            const contextPrompt = CONTEXT_PROMPT;
            const role = ROLE;
            const availableTools = AVAILABLE_TOOLS;

            const fullPrompt = `
            ${role}
      
            ## Current date
            Today is ${currentDate}.
            ## Official language context:
            ${languageContext}
            ${referringUrlContext}

            
          
            ${BASE_SYSTEM_PROMPT.replaceAll('### CONTEXT_PROMPT ###', contextPrompt).replaceAll('### CITATION INSTRUCTIONS ###', citationInstructions)}
      
            ## General Instructions/Scenarios for All Departments
            ${SCENARIOS}
      
            
      
          Reminder: the answer should be brief, in plain language, accurate and must be sourced from Government of Canada online content at ALL turns in the conversation. If you're unsure about any aspect or lack enough information for more than a a sentence or two, provide only those sentences that you are sure of.
          `;


            return fullPrompt;

        } catch (error) {
            await ServerLoggingService.error('system', 'PROMPT BUILDER SERVICE ERROR:', error);
            return `Error assembling full prompt. Proceed with caution.`;
        }
    }
}

export { PromptBuilderService };
// Export a singleton instance
export default new PromptBuilderService();
