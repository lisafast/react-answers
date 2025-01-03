// import { BASE_SYSTEM_PROMPT } from './systemPrompt/base.js';
import { BASE_SYSTEM_PROMPT } from './systemPrompt/agenticBase.js';
import { SCENARIOS } from './systemPrompt/scenarios-all.js';
import { CITATION_INSTRUCTIONS } from './systemPrompt/citationInstructions.js';

const ROLE = `## Role
You are an AI assistant specializing in Government of Canada information found on Canada.ca and sites with the domain suffix "gc.ca". Your primary function is to help site visitors by providing brief helpful answers to their Government of Canada questions with a citation to help them take the next step of their task and verify the answer.`;

// Create a map of department-specific content imports
const departmentModules = {
  CRA: {
    updates: () => import('./systemPrompt/context-cra/cra-updates.js').then(m => m.CRA_UPDATES),
    scenarios: () => import('./systemPrompt/context-cra/cra-scenarios.js').then(m => m.CRA_SCENARIOS)
  },
  ESDC: {
    updates: () => import('./systemPrompt/context-esdc/esdc-updates.js').then(m => m.ESDC_UPDATES),
    scenarios: () => import('./systemPrompt/context-esdc/esdc-scenarios.js').then(m => m.ESDC_SCENARIOS)
  },
  ISC: {
    updates: () => import('./systemPrompt/context-isc/isc-updates.js').then(m => m.ISC_UPDATES),
    scenarios: () => import('./systemPrompt/context-isc/isc-scenarios.js').then(m => m.ISC_SCENARIOS)
  },
  PSPC: {
    updates: () => import('./systemPrompt/context-pspc/pspc-updates.js').then(m => m.PSPC_UPDATES),
    scenarios: () => import('./systemPrompt/context-pspc/pspc-scenarios.js').then(m => m.PSPC_SCENARIOS)
  },
  IRCC: {
    updates: () => import('./systemPrompt/context-ircc/ircc-updates.js').then(m => m.IRCC_UPDATES),
    scenarios: () => import('./systemPrompt/context-ircc/ircc-scenarios.js').then(m => m.IRCC_SCENARIOS)
  }
  // Add more departments as needed
};

async function loadSystemPrompt(language = 'en', context) {
  console.log(`🌐 Loading system prompt for language: ${language.toUpperCase()}, context: ${context}`);

  try {
    const department = context.department;

    // Always start with general scenarios as the base
    let departmentContent = { updates: '', scenarios: SCENARIOS };
    
    // Load department-specific content if available and append to general scenarios
    if (department && departmentModules[department]) {
      try {
        const [updates, scenarios] = await Promise.all([
          departmentModules[department].updates(),
          departmentModules[department].scenarios()
        ]);
        
        departmentContent = {
          updates,
          scenarios
        };
        
        console.log(`🏢 Loaded specialized content for ${department.toUpperCase()}: ${language.toUpperCase()}`);
      } catch (error) {
        console.warn(`Failed to load specialized content for ${department}, using defaults`, error);
      }
    }

    // Select language-specific content
    // const menuStructure = language === 'fr' ? menuStructure_FR : menuStructure_EN;
    // console.log(`📚 Loaded menu structure: ${language.toUpperCase()}`);
    
    const citationInstructions = CITATION_INSTRUCTIONS;

    // Inform LLM about the current page language
    const languageContext = language === 'fr' 
      ? "The user is asking the question on a French Government of Canada page. Language context is French."
      : "The user is asking their question on an English Government of Canada page.";

    // Update the department context sections
    const departmentUpdatesSection = department 
      ? `## Updated pages for this department\n${departmentContent.updates}`
      : '';
    
    const departmentScenariosSection = department 
      ? `## Important scenarios for this department\n${departmentContent.scenarios}`
      : `## Important general instructions for all departments\n${SCENARIOS}`;

    // Add current date information
    const currentDate = new Date().toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    
    // add context into systme prompt
    const contextPrompt = `## Current Context for question ##
    Department: ${context.department}
    Topic: ${context.topic}
    Topic URL: ${context.topicUrl}
    Department URL: ${context.departmentUrl}
    Search Results: ${context.searchResults}
    `;
    

    const fullPrompt = `
      ${ROLE}

      ## Current Context
      Today is ${currentDate}.
      ${languageContext}

      ${BASE_SYSTEM_PROMPT}

      ${contextPrompt}

      ${citationInstructions}

      ${departmentUpdatesSection}

      ${departmentScenariosSection}
    `;

    console.log(`✅ System prompt successfully loaded in ${language.toUpperCase()} (${fullPrompt.length} chars)`);
    return fullPrompt;

  } catch (error) {
    console.error('SYSTEM PROMPT ERROR:', {
      message: error.message,
      stack: error.stack
    });

    return BASE_SYSTEM_PROMPT;
  }
}

export default loadSystemPrompt;