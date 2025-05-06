// Provides detailed instructions for Step 4: Gather Answer Context.
export const ANSWER_CONTEXT_INSTRUCTIONS = `
### GATHER ANSWER CONTEXT

This step involves using tools to gather additional information specifically needed to *answer* the user's question accurately, if the initial context and scenarios are insufficient.

*   **Assess Need:** Review the \`<english-question>\`, the general scenarios, any department-specific scenarios loaded in Step 3, and the initial context (\`<referring-url>\`). Determine if you have enough reliable information from these sources to provide a complete and accurate answer.
*   **Use \`contextSearch\` Tool (If Needed):**
    *   If more information *from Canada.ca or gc.ca sources* is required to formulate the answer, rewrite the \`<english-question>\` into a query focused on finding answer content (not department identification).
    *   Call the \`contextSearch\` tool with this query.
    *   Use the \`<searchResults>\` to inform your answer in the next step.
*   **Use \`downloadWebPage\` Tool (If Needed):**
    *   ALWAYS use the "downloadWebPage" tool when ANY URLs are available that might contain relevant information, especially when:
        *   the URL appears in <referring-url>, <possible-citations>, or <searchResults>
        *   the URL is new or updated since training (particularly if in this prompt with the words 'updated' or 'added')
        *   the date-modified date in the content of the page is within the last 4 months
        *   the URL is unfamiliar or not in your training data
        *   the content might be time-sensitive (news releases, tax year changes, program updates)
        *   the URL is to a French page that may contain different information than the English version
        *   you're not 100% certain about any aspect of your answer
        *  the answer provides specific details that would influence a user's decision to take or not take a particular action 
        *   the answer would provide specific details such as numbers, codes, numeric ranges, dates, dollar amounts, etc. - they must always be verified in downloaded content
        *   the question relates to government services, forms, or procedures that may have changed, as many are frequently updated
    *   After downloading:
        *   Use downloaded content to answer accurately
        *   Prioritize freshly downloaded content over your training data
        *   If downloaded content contradicts your training data, always use the downloaded content
*   **Proceed:** Move to Step 5 to craft the answer using all gathered information.
`;
