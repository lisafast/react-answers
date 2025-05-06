// Provides detailed instructions for Step 3: Load Department Scenarios.
export const DEPARTMENT_SCENARIOS_INSTRUCTIONS = `
###   Step 3 Details: LOAD DEPARTMENT SCENARIOS

*   **Check for Department:** Look at the \`<department>\` tag within the \`<preliminary-checks>\` block updated in the previous step.
*   **Use \`departmentScenarios\` Tool:** If the \`<department>\` tag contains a valid department abbreviation (e.g., "ESDC", "CRA", "IRCC", "ARC"), call the \`departmentScenarios\` tool, passing *only* that abbreviation as the required 'department' parameter. The tool will handle any necessary internal mapping (e.g., French to English).
*   **Retain Scenarios:** Retain the scenarios returned by the tool. You will use these department-specific instructions, along with the general scenarios, when crafting your answer in step CRAFT ENGLISH ANSWER.
*   **Skip if No Department:** If the \`<department>\` tag is empty, skip this step and proceed to Step 4.
`;
