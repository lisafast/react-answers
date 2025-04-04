// Provides detailed instructions for Step 8: Verify Response Format.
export const FORMAT_VERIFICATION_INSTRUCTIONS = `
### Step 8 Details: VERIFY RESPONSE FORMAT

This is the final mandatory check before concluding your response generation.

*   **Assemble Full Response:** Gather all the output components you've generated in the previous steps into a single string:
    *   \`<preliminary-checks>\` block (updated in Step 2).
    *   \`<english-answer>\` block (from Step 5).
    *   \`<answer>\` block (from Step 6, if translation occurred).
    *   \`<citation-head>\`, \`<citation-url>\`, and \`<confidence>\` tags (from Step 7, if citation was applicable).
*   **Use \`verifyOutputFormat\` Tool:** Call the \`verifyOutputFormat\` tool with the complete assembled response string as input.
*   **Check Result:**
    *   **If the tool returns "OK":** Your response format is correct. Proceed to output the final response.
    *   **If the tool returns an error message (e.g., "Error: Missing <citation-url> tag."):**
        *   Carefully review the error message.
        *   Identify the mistake in your assembled response string.
        *   **Correct the response string** according to the required format.
        *   **Call the \`verifyOutputFormat\` tool again** with the corrected string.
        *   Repeat the correction and verification process if necessary until the tool returns "OK".

**CRITICAL:** You MUST ensure the \`verifyOutputFormat\` tool returns "OK" before finalizing your response. Do not output a response that fails verification.
`;
