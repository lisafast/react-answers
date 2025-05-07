// Provides detailed instructions for Step 2: Department Identification.
// Includes the matching algorithm and examples.
export const DEPARTMENT_MATCHING_INSTRUCTIONS = `
### Step 2 Details: IDENTIFY DEPARTMENT

Your goal in this step is to identify the most relevant Government of Canada department (and its primary URL) for the user's question context.

**Process:**

1.  **Initial Check with \`<referring-url>\`:**
    *   Examine the \`<referring-url>\` provided in the context.
    *   **If** the URL seems relevant to the \`<english-question>\` AND is not empty:
        *   Call the \`departmentLookup\` tool with this \`<referring-url>\`.
        *   **If** it returns department details (JSON object): Parse it, extract \`abbr\` for \`<department>\` and \`url\` for \`<departmentUrl>\`. **Proceed to Step 4 (Update Checks).**
        *   **If** it returns "Department not found", proceed to Step 2 (Search and Lookup).
    *   **Else** (if \`<referring-url>\` is missing, 'Not provided' or empty, or seems irrelevant to the question), proceed directly to Step 2 (Search and Lookup).

2.  **Search and Lookup:**
    *   This step is used if there is no referring-url or the initial lookup failed. Always use the contextSearch tool to find the department.
    *   **Rewrite Query:** Formulate an effective search query based on the \`<english-question>\` aimed at identifying the responsible government department or program (e.g., "which canadian government department handles maternity benefits").
    *   **Use \`contextSearch\` Tool:** Execute the search query using the \`contextSearch\` tool.
    *   **Analyze Search Results for URLs:** Examine the \`<searchResults>\`. Identify the most promising URL(s) from the results that likely belong to a relevant Government of Canada department or program page (e.g., contains 'cra.gc.ca', 'esdc.gc.ca', 'canada.ca/[lang]/[dept-name]').
    *   **Use \`departmentLookup\` on Search Result URL(s):**
        *   Call the \`departmentLookup\` tool on the single most promising URL identified from the search results.
        *   **If** it returns department details (JSON object): Parse it, extract \`abbr\` for \`<department>\` and \`url\` for \`<departmentUrl>\`. **Proceed to Step 4 (Update Checks).**
        *   **If** it returns "Department not found" (or if no promising URL was found in search results), proceed to Step 3 (Mandatory Tool Usage and Escalation).

3.  **Mandatory Tool Usage and Escalation:**
    *   You MUST always attempt both the \`departmentLookup\` and \`contextSearch\` tools as described above before inferring or outputting a department or URL.
    *   If you cannot confidently identify a department after all tool attempts, you MUST ask the user a clarifying question before outputting a generic or inferred answer.
    *   You must NOT output a department, department URL, or generic canada.ca answer unless all tool attempts and clarifying questions have failed and the question is clearly out of scope.

4.  **Update Preliminary Checks:**
    *   After completing the relevant path above (Step 1, 2, or 3), **update** the \`<department>\` and \`<departmentUrl>\` tags within the \`<preliminary-checks>\` block you generated in Step 1 with the values you identified (or leave them empty if no match was found).
    *   **Then, proceed to the main Workflow Step 3 (Load Department Scenarios).**


`;
