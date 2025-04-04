# Agent Architecture and Workflow Decision Log

Date: 2025-04-02

## Initial Question

The initial discussion centered around whether to use a separate agent for context building before passing the query to a main response agent, or to equip a single main agent with sufficient tools to handle the entire process.

## Analysis

We examined the existing agent structure (`agentFactory.js`, `toolFactory.js`) and system prompts (`systemPrompt.js`, `contextSystemPrompt.js`, `agenticBase.js`).

Key findings:
- The system had concepts of a `MessageAgent` and a `ContextAgent`.
- A `ContextTool` existed but was found to wrap another LLM call (`invokeContextAgent`), adding latency and cost.

## User-Defined Workflow

The desired workflow was defined as:
1. Input: Question, `referringUrl`.
2. Tool Use (Conditional): `DepartmentLookupTool` (if `referringUrl`).
3. Tool Use (Conditional): `DepartmentScenariosTool` (if department found) - *Correction: This tool provides context, not an early exit.*
4. LLM Task: Rewrite question for search.
5. Tool Use: Search Tool (e.g., `googleContextSearchTool`).
6. LLM Task: Analyze search results (potentially identify department if not found earlier).
7. Tool Use: `downloadWebPageTool` (if needed).
8. LLM Task: Synthesize answer using all gathered context (general scenarios, department scenarios, downloaded content).
9. Tool Use (Added): `VerifyOutputFormatTool` to check the final response structure.

## Decision: Single Agent Architecture

Based on the defined workflow, which involves sequential tool use orchestrated by LLM reasoning steps, a **single agent architecture** was chosen.

**Rationale:**
- **Efficiency:** Avoids overhead of passing state and control between multiple agents.
- **Simplicity:** Easier to manage tools and prompt logic for one agent.
- **Capability:** Standard agent frameworks (like Langchain React Agent) are well-suited for this type of multi-step, tool-using reasoning.
- **Avoids Hidden LLM Calls:** Explicitly removing the `ContextTool` (which called another LLM) and using direct tools ensures only one primary LLM reasoning cycle for the main response generation.

## Implementation Steps Taken

1.  **Removed `ContextTool`:** The `ContextTool` (which wrapped an LLM call) was removed from the standard toolset in `agents/toolFactory.js`.
2.  **Created `VerifyOutputFormatTool`:** A new tool was created (`agents/tools/verifyOutputFormatTool.js`) to validate the final output structure.
3.  **Updated Standard Tools:** `agents/toolFactory.js` was updated to include `DepartmentLookupTool`, `DepartmentScenariosTool`, `googleContextSearchTool`, `downloadWebPageTool`, and the new `VerifyOutputFormatTool` in the standard set for the main agent.
4.  **Updated System Prompt:** The core workflow logic in `services/systemPrompt/agenticBase.js` was modified to reflect the 7-step process including the new tool calls and context handling logic.

## Conclusion

The system now uses a single agent (`createMessageAgent`) equipped with a specific set of tools and guided by a detailed system prompt (`agenticBase.js`) to execute the desired workflow, including context gathering, scenario application, content retrieval, answer synthesis, and final format verification.
