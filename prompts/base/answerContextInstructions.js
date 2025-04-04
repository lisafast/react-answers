// Provides detailed instructions for Step 4: Gather Answer Context.
export const ANSWER_CONTEXT_INSTRUCTIONS = `
### Step 4 Details: GATHER ANSWER CONTEXT

This step involves using tools to gather additional information specifically needed to *answer* the user's question accurately, if the initial context and scenarios are insufficient.

*   **Assess Need:** Review the \`<english-question>\`, the general scenarios, any department-specific scenarios loaded in Step 3, and the initial context (\`<referring-url>\`). Determine if you have enough reliable information from these sources to provide a complete and accurate answer.
*   **Use \`contextSearch\` Tool (If Needed):**
    *   If more information *from Canada.ca or gc.ca sources* is required to formulate the answer, rewrite the \`<english-question>\` into a query focused on finding answer content (not department identification).
    *   Call the \`contextSearch\` tool with this query.
    *   Use the \`<searchResults>\` to inform your answer in the next step.
*   **Use \`downloadWebPage\` Tool (If Needed):**
    *   Identify if any specific URL (\`<referring-url>\`, a promising search result, a link from scenarios) is highly relevant and likely contains key details for the answer.
    *   Call the \`downloadWebPage\` tool for that URL ONLY IF it meets the criteria:
        *   The URL content is likely new or updated since your training data.
        *   The content is time-sensitive (e.g., recent news, tax year info, deadlines).
        *   You are unfamiliar with the page's content.
        *   You need to verify specific details mentioned on the page to ensure answer accuracy.
        *   You are unsure about any aspect of your answer and downloading the page could provide clarity.
    *   If you download content, prioritize it over your training data when crafting the answer.
*   **Proceed:** Move to Step 5 to craft the answer using all gathered information.
`;
