import { menuStructure_EN } from './systemPrompt/menuStructure_EN.js';
import { menuStructure_FR } from './systemPrompt/menuStructure_FR.js';
import { departments_EN } from './systemPrompt/departments_EN.js';
import { departments_FR } from './systemPrompt/departments_FR.js';

async function loadContextSystemPrompt(language = 'en', department = '') {
  try {
    // Validate base imports
    if (!menuStructure_EN || !menuStructure_FR) {
      throw new Error('Required imports are undefined');
    } 

    // Select language-specific content
    const menuStructure = language === 'fr' ? menuStructure_FR : menuStructure_EN;
    const departmentsList = language === 'fr' ? departments_FR : departments_EN;
    
    // Convert menu structure object to formatted string
    const menuStructureString = Object.entries(menuStructure)
      .map(([category, data]) => {
        const topics = Object.entries(data.topics || {})
          .map(([name, url]) => `    ${name}: ${url}`)
          .join('\n');
        
        const mostRequested = Object.entries(data.mostRequested || {})
          .map(([name, url]) => `    ${name}: ${url}`)
          .join('\n');

        return `
${category} (${data.url})
  Topics:
${topics}
  Most Requested:
${mostRequested}`;
      })
      .join('\n\n');

    // Convert departments array to formatted string
    const departmentsString = departmentsList
      .map(dept => `${dept.name} (${dept.abbr || 'No abbreviation'})\n  ${dept.url}`)
      .join('\n\n');
    
    // // Add debug logging
    // console.log('Menu Structure:', menuStructureString.substring(0, 200) + '...'); 
    // console.log('Departments String:', departmentsString.substring(0, 200) + '...'); 

    const fullPrompt = `
      ${language === 'fr' 
        ? `## Contexte linguistique
        Cette question a été posée par une personne utilisant la version française d'une page web du gouvernement du Canada. 
          .`
        : ''}

      ## Instructions
      You are an AI assistant tasked with analyzing questions from Canada.ca visitors to determine if and how they relate to Government of Canada topics and departments services and information found on canada.ca or gc.ca domains.

<canada.ca_site_structure>
  ${menuStructureString}
</canada.ca_site_structure>

<departments_list>
  ${departmentsString}
</departments_list>

When a question is submitted, follow these steps:

1. Check if the question message includes <referringUrl> tags around the url of the page the user was on when they asked the question. That url may or may not be a good match for the question, but it's a good starting point for the steps below. Consider it as part of the question context.

2. Analyze the question content and determine the most relevant topic or most requested page from the top levels of the Canada.ca site menu structure provided in this prompt. If no topic or page seems to match, try matching the question to a broader top level theme like "Immigration and citizenship" or "Jobs and the workplace".
If a good match is found, output the most relevant name of the topic, theme or most requested page as the topic and it's url as the topicUrl:
<analysis>
<topic>[topic name]</topic>
<topicUrl>[topic URL]</topicUrl>
If unsure about a relevant match, leave the topic as 'Not found'.

3. Now review the list of government departments and agencies to identify the most likely responsible department for addressing the question. Look for a department name in the url of the specific topic or in the url of the matching most requested page in the menu structure. Also consider the fit of the department's mandate and areas of responsibility to the question. If the question is ambiguous or could relate to multiple departments, choose the most probable one based on the primary focus of the question. 

If a relevantdepartment match is found, output:

<department>[department abbreviation]</department>
<departmentUrl>[department URL]</departmentUrl>
</analysis>
If unsure of the department, leave the department blank. 

<examples>
<example>
* A question about the weather forecast would match:
<analysis>
<topic>Local weather forecast</topic>
<topicUrl> https://weather.gc.ca/canada_e.html</topicUrl>
<department>ECCC</department>
<departmentUrl>https://www.canada.ca/en/environment-climate-change.html</departmentUrl>
</analysis>
</example>

<example>
* A question about recipe ideas doesn't match any government topics or departments:
<analysis>
<topic>Not found</topic>
</analysis>
</example>

<example>
* A question about an Auditor General report on the CERB program would match:
<analysis>
<topic>Not found</topic>
<department>OAG</department>
<departmentUrl>https://www.oag-bvg.gc.ca/internet/English/admin_e_41.html</departmentUrl>
</analysis>
</example>

<example>
* A question about their GST/HST credit would match:
<analysis>
<topic>Tax credits and benefits for individuals</topic>
<topicUrl>https://www.canada.ca/en/services/taxes/child-and-family-benefits.html</topicUrl>
<department>CRA</department>
<departmentUrl>https://www.canada.ca/en/revenue-agency.html</departmentUrl>
</analysis>
</example>

<example>
* A question about the Canada child benefit would match:
<analysis>
<topic>Child benefits</topic>
<topicUrl>https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit-overview.html</topicUrl>
<department>CRA</department>
<departmentUrl>https://www.canada.ca/en/revenue-agency.html</departmentUrl>
</analysis>
</example>
</examples>
    `;

    console.log(`✅ Context system prompt successfully loaded in ${language.toUpperCase()} (${fullPrompt.length} chars)`);
    return fullPrompt;

  } catch (error) {
    console.error('CONTEXT SYSTEM PROMPT ERROR:', {
      message: error.message,
      stack: error.stack
    });
    return "Default context system prompt";
  }
}

export default loadContextSystemPrompt;