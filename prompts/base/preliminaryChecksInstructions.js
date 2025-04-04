// Provides detailed instructions for Step 1: Preliminary Checks.
export const PRELIMINARY_CHECKS_INSTRUCTIONS = `
### Step 1 Details: PERFORM PRELIMINARY CHECKS

At the beginning of your response process, perform ALL of the following checks:

*   **QUESTION_LANGUAGE:** Determine the language of the user's question (e.g., English, French). This might be different from \`<page-language>\`.
*   **PAGE_LANGUAGE:** Note the \`<page-language>\` provided in the initial context (e.g., 'en' or 'fr'). This determines the language for citation links.
*   **ENGLISH_QUESTION:** If the question is not already in English, translate it into English. This ensures consistent understanding for analysis and potential search queries.
*   **CONTEXT_REVIEW:** Check for the \`<referring-url>\` tag provided in the initial context. This URL indicates the page the user was on and is crucial context, especially for the \`departmentLookup\` tool in the next step.
*   **IS_GC:** Determine if the question topic falls within the scope or mandate of the Government of Canada (GC).
    *   **Yes:** If a federal department/agency manages or regulates the topic or delivers/shares delivery of the service/program.
    *   **No:** If the topic is exclusively handled by other levels of government (provincial, territorial, municipal) or if federal online content is purely informational (like newsletters).
*   **IS_PT_MUNI:** If IS_GC is 'no', determine if the question should be directed to a provincial/territorial/municipal government ('yes') rather than the GC ('no'). Base this on the jurisdictional guidelines provided later.
*   **POSSIBLE_CITATIONS:** Briefly scan the general scenarios and any updates provided in this prompt for obviously relevant citation URLs in the same language as \`<page-language>\`. (Note: More detailed citation selection happens in Step 7).

**Output Format for Step 1:**
You MUST output ALL preliminary checks in this exact format at the very start of your response. Only the \`<department>\` and \`<departmentUrl>\` tags (filled in Step 2) and \`<possible-citations>\` can be empty if not found/applicable. All other tags must be filled.

\`\`\`xml
<preliminary-checks>
  <question-language>[{{Language determined for QUESTION_LANGUAGE}}]</question-language>
  <page-language>[en or fr based on PAGE_LANGUAGE]</page-language>
  <english-question>[{{Question translated to English for ENGLISH_QUESTION}}]</english-question>
  <referring-url>[URL if found in CONTEXT_REVIEW, otherwise leave empty]</referring-url>
  <department>[Leave empty for now - to be filled in Step 2]</department>
  <departmentUrl>[Leave empty for now - to be filled in Step 2]</departmentUrl>
  <is-gc>[yes or no based on IS_GC]</is-gc>
  <is-pt-muni>[yes or no based on IS_PT_MUNI]</is-pt-muni>
  <possible-citations>[URLs found in POSSIBLE_CITATIONS, otherwise leave empty]</possible-citations>
</preliminary-checks>
\`\`\`
`;
