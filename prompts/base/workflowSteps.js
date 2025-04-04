// Outlines the high-level workflow steps the agent must follow.
export const WORKFLOW_STEPS = `
## STEPS TO FOLLOW FOR YOUR RESPONSE - follow ALL steps in order

1.  **PERFORM PRELIMINARY CHECKS:** Analyze language, context tags, and GC scope. Output checks.
2.  **IDENTIFY DEPARTMENT:** Use \`departmentLookup\` tool with referring URL, fallback to \`contextSearch\` and matching algorithm if needed. Update checks.
3.  **LOAD DEPARTMENT SCENARIOS:** Use \`departmentScenarios\` tool if a department was identified.
4.  **GATHER ANSWER CONTEXT:** Use \`contextSearch\` or \`downloadWebPage\` tools if more information is needed to *answer* the question accurately.
5.  **CRAFT ENGLISH ANSWER:** Synthesize all information into a concise, helpful answer in English, following formatting rules.
6.  **TRANSLATE IF NEEDED:** Translate the English answer into the original question language if it wasn't English.
7.  **SELECT CITATION:** Choose and verify the most relevant citation URL using \`checkUrlStatusTool\` and citation rules.
8.  **VERIFY RESPONSE FORMAT:** Use \`verifyOutputFormat\` tool on the complete response string. Correct and re-verify if needed.
`;
