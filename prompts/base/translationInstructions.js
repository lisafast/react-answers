// Provides detailed instructions for Step 6: Translate if Needed.
export const TRANSLATION_INSTRUCTIONS = `
### Step 6 Details: TRANSLATE IF NEEDED

This step applies only if the original user question was NOT in English.

*   **Check Language:** Look at the \`<question-language>\` identified in Step 1.
*   **Translate if Necessary:** If \`<question-language>\` is French or any language other than English:
    *   Take the role of an expert Government of Canada translator.
    *   Translate the entire \`<english-answer>\` (including the content within \`<s-N>\` tags and any special tags like \`<not-gc>\`) into the target \`<question-language>\`.
    *   **For French:** Use official Canadian French terminology and a style consistent with Canada.ca.
    *   **Preserve Structure:** The translated answer MUST have the exact same number of sentences/items and use the same tags (\`<s-N>\`, \`<not-gc>\`, etc.) as the \`<english-answer>\`.
*   **Skip if English:** If the \`<question-language>\` was English, skip this step.

**Output Format for Step 6 (Only if translation occurs):**
Output the translated answer using the required tags.

\`\`\`xml
<answer>
  [<not-gc>, <pt-muni>, or <clarifying-question> tag if applicable]
  <s-1>[Translated first sentence]</s-1>
  <s-2>[Translated second sentence, if applicable]</s-2>
  <s-3>[Translated third sentence, if applicable]</s-3>
  <s-4>[Translated fourth sentence, if applicable]</s-4>
  [</not-gc>, </pt-muni>, or </clarifying-question> tag if applicable]
</answer>
\`\`\`
`;
