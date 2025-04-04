// Provides detailed instructions for Step 7: Select Citation.
// Replaces the old standalone citation instructions file.
export const CITATION_INSTRUCTIONS = `
### Step 7 Details: SELECT CITATION

This step determines the appropriate citation link to provide with the answer.

*   **Check for Exclusions:** If the answer includes the \`<not-gc>\`, \`<pt-muni>\`, or \`<clarifying-question>\` tags, **SKIP** the rest of this step and do not provide a citation.
*   **Gather Citation Context:** Consider the following to select the best URL:
    *   The final answer content (\`<english-answer>\` and \`<answer>\` if translated).
    *   The \`<page-language>\` (to choose 'en' or 'fr' URL).
    *   The identified \`<department>\` and \`<departmentUrl>\` (from Step 2).
    *   The \`<referring-url>\` (from Step 1).
    *   Relevant URLs from general and department scenarios (\`<possible-citations>\` from Step 1 and scenario content). Prioritize these over search results.
    *   URLs found via \`contextSearch\` in Step 4 (use cautiously, verify relevance to the *answer*, not just the question).
*   **Citation Selection Rules:**
    1.  **Relevance & Language:** Select ONE URL that best helps the user take the next step or directly supports the answer provided. The URL MUST match the \`<page-language>\`. If the answer explicitly mentions or implies using a specific page, that page's URL MUST be selected.
    2.  **Prioritize Next Step:** Prefer URLs leading to the user's next logical action (e.g., eligibility page, application info page) over direct form links or broad homepages, unless the homepage is the most appropriate next step.
    3.  **Validity Requirements:** The chosen URL MUST:
        *   Use \`https://\`.
        *   Be from \`canada.ca\`, \`gc.ca\`, or the identified \`<departmentUrl>\`.
        *   Be a production URL (no staging/dev links).
        *   Be correctly formatted.
*   **URL Verification Process:**
    *   **Use \`checkUrlStatusTool\`:** You MUST verify your chosen URL using the \`checkUrlStatusTool\`.
    *   **Handle Failures:** If the URL fails verification (returns non-live status):
        *   Attempt to find and verify up to 5 alternative relevant URLs (e.g., slightly different path, parent page).
        *   If alternatives fail, use the fallback hierarchy:
            a.  Relevant URL from the breadcrumb trail of the original target.
            b.  Most relevant Canada.ca theme page (\`https://www.canada.ca/[lang]/services/...\`).
            c.  The \`<departmentUrl>\` if available and verified.
            d.  If all fallbacks fail verification, do not provide a citation URL.
*   **Confidence Rating:** Include a confidence rating based on the final selected URL:
    *   \`1.0\`: High confidence match (e.g., URL explicitly mentioned in answer, direct source).
    *   \`0.9\`: Specific relevant page (e.g., \`<referring-url>\` if appropriate, specific topic page with ≤5 path segments).
    *   \`0.7\`: Less specific but related topic URL or the \`<departmentUrl>\`.
    *   \`0.5\`: Fallback URL (breadcrumb, theme page).

**Output Format for Step 7 (If citation is applicable):**
Output the citation heading and URL using the required tags.

\`\`\`xml
<citation-head>[Heading in the original question language: "Check your answer and take the next step:" or French equivalent]</citation-head>
<citation-url>[The final, verified citation URL]</citation-url>
<confidence>[Confidence rating number: 1.0, 0.9, 0.7, or 0.5]</confidence>
\`\`\`
`;
