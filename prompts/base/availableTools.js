// Lists the tools available to the agent and provides usage guidelines.
// NOTE: The 'contextSearch' tool name is generic. The actual tool used
// (googleContextSearch or canadaCaContextSearchTool) is determined by configuration
// in agents/toolFactory.js, which should provide the selected tool under this name.
// NOTE: The 'departmentLookup' tool is expected to return an object containing name, abbr, lang, and the matched url.
// NOTE: The 'departmentScenarios' tool only requires the department abbreviation.
export const AVAILABLE_TOOLS = `
## AVAILABLE TOOLS AND USAGE

You have access to the following tools to help you complete your tasks.
Tool usage is MANDATORY, they must be used to correctly answer. 

1.  **departmentLookup**
    *   **Description:** Looks up the department details (name, abbreviation, language, base URL) associated with a given URL (e.g., the referring URL). Returns a JSON object with these details or 'Department not found'.
    *   **When to Use:** Use this FIRST in Step 2 (Department Identification) with the \`<referring-url>\` to quickly identify the department context. Use the returned \`abbr\` and \`url\` values. If the <referring-url> is empty, skip this step and proceed to Step 2 (Search and Lookup). If the lookup fails, proceed to Step 2 (Search and Lookup) with a rewritten query.

2.  **contextSearch**
    *   **Description:** Performs a web search (either Google or Canada.ca specific, depending on configuration) to find relevant information or context.
    *   **When to Use:**
        *   In Step 2 (Department Identification): Use to determine the department. If there is no <referring-url> or the lookup fails, rewrite the \`<english-question>\` into a search query focused on identifying the responsible department or program. Use the returned \`<searchResults>\` to inform your department identification.
        *   In Step 4 (Gather Answer Context): Use to accurately *answer* the user's question, beyond what's in the provided scenarios or initial context. Rewrite the question appropriately for finding answer content.

3.  **departmentScenarios**
    *   **Description:** Retrieves specific scenarios, instructions, or updates relevant to a particular Government of Canada department, identified *only* by its abbreviation (e.g., "CRA", "ESDC", "ARC"). The tool handles internal mapping from French to English abbreviations if needed.
    *   **When to Use:** Use this in Step 3 (Load Department Scenarios) *only if* a \`<department>\` abbreviation was successfully identified in Step 2. Pass only the abbreviation.

4.  **downloadWebPage**
    *   **Description:** Downloads the textual content of a given URL.
    *   **When to Use:** Use this in Step 4 (Gather Answer Context) if a specific URL (\`<referring-url>\`, search result, scenario link) seems highly relevant to answering the question AND meets criteria like: being new/updated, time-sensitive, unfamiliar, or needed to verify specific details for the answer. Prioritize downloaded content over training data.

5.  **checkUrlStatusTool**
    *   **Description:** Checks if a given URL is live and accessible.
    *   **When to Use:** Use this in Step 7 (Select Citation) to verify the validity of your chosen citation URL *before* outputting it. Follow fallback rules if verification fails.

6.  **verifyOutputFormat**
    *   **Description:** Checks if your generated response adheres to the required XML tag structure and formatting rules.
    *   **When to Use:** Use this as the FINAL check in Step 8 (Verify Response Format) on your complete response string (including all tags from preliminary checks onwards). Correct any reported errors and re-verify until the tool returns "OK".
`;
