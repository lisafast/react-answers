# Prompt Refactoring: Modular Structure and Builder Service (April 2025)

## Overview

This document outlines the refactoring of the AI Answers system prompts from a multi-file, partially duplicated structure to a modular, single-agent architecture managed by a dedicated `PromptBuilderService`. This change aims to improve maintainability, testability, and alignment with the available agent tools.

## Rationale

The previous prompt structure involved:
*   Separate prompts for context/department matching (`contextSystemPrompt.js`) and answer generation (`agenticBase.js`, `systemPrompt.js`).
*   Redundant logic for department identification in `agenticBase.js`.
*   Inconsistent or outdated tool names and usage instructions.
*   Difficulty in managing and updating the large, monolithic `agenticBase.js`.
*   Lack of a straightforward way to inject custom prompts for testing.

The new structure addresses these issues by:
*   Consolidating all logic into a single-agent flow.
*   Breaking down prompt instructions into smaller, focused modules.
*   Introducing a `PromptBuilderService` to assemble the final prompt dynamically.
*   Supporting client-side prompt overrides for testing purposes.
*   Leveraging tools like `departmentLookup` more effectively.
*   Using a generic name (`contextSearch`) for the configured search tool.

## New Architecture

### 1. Prompt Modules (`prompts/base/`)

The core prompt logic is now divided into the following modules:

*   `roleAndGoal.js`: Defines the core AI role.
*   `availableTools.js`: Lists available tools (`departmentLookup`, `contextSearch`, `departmentScenarios`, `downloadWebPage`, `checkUrlStatusTool`, `verifyOutputFormat`) and usage guidelines.
*   `workflowSteps.js`: Outlines the 8-step agent workflow.
*   `preliminaryChecksInstructions.js`: Details for Step 1 (Language, Context, GC Scope).
*   `departmentMatchingInstructions.js`: Details for Step 2 (Using `departmentLookup`, fallback to `contextSearch` + algorithm/examples).
*   `departmentScenariosInstructions.js`: Details for Step 3 (Using `departmentScenarios`).
*   `answerContextInstructions.js`: Details for Step 4 (Using `contextSearch`, `downloadWebPage`).
*   `answerCraftingInstructions.js`: Details for Step 5 (Synthesizing answer).
*   `translationInstructions.js`: Details for Step 6 (Translating if needed).
*   `citationInstructions.js`: Details for Step 7 (Using `checkUrlStatusTool`).
*   `formatVerificationInstructions.js`: Details for Step 8 (Using `verifyOutputFormat`).
*   `keyGuidelines.js`: General rules (sources, structure, PII, jurisdiction, etc.).

### 2. Data Files (`data/`)

Static data used by tools or potentially other services are stored here:

*   `data/departments/departments_EN.js`: English department list (used by `DepartmentLookupTool`).
*   `data/departments/departments_FR.js`: French department list (used by `DepartmentLookupTool`).
*   `data/menuStructure/menuStructure_EN.js`: English menu structure data (archived, currently unused).
*   `data/menuStructure/menuStructure_FR.js`: French menu structure data (archived, currently unused).

### 3. Prompt Builder Service (`services/PromptBuilderService.js`)

*   This service imports the modules from `prompts/base/` and general scenarios from `prompts/scenarios/scenarios-all.js`.
*   Its `buildPrompt` method assembles the complete prompt string, injecting dynamic context (date, language, referring URL).

### 3. Agent Invocation Logic (e.g., `services/ChatPipelineService.js` or `services/ChatProcessingService.js`)

*   Checks for an `overrideSystemPrompt` field in the incoming request.
*   Verifies user authorization for the override.
*   If present and authorized, uses the override value.
*   Otherwise, uses `PromptBuilderService.buildPrompt()` to generate the standard prompt.

### 4. Required Code Changes

*   **`agents/tools/DepartmentLookupTool.js`:** Must be updated to return the `url` of the matched department in its result.
*   **`agents/toolFactory.js`:** Must be updated to provide the configured search tool (Google or Canada.ca) under the generic name `contextSearch`.
*   **Agent Invocation Point:** Needs modification to implement the `overrideSystemPrompt` check and call the `PromptBuilderService`.
*   **`agents/tools/DepartmentLookupTool.js`:** Import paths for department lists updated to point to `../../data/departments/`.

### 5. Deprecated/Replaced Files

The following files are made obsolete by this refactoring:

*   `prompts/base/agenticBase.js`
*   `prompts/contextSystemPrompt.js`
*   `services/contextSystemPrompt.js`
*   `prompts/base/citationInstructions.js` (content moved to new module)
*   `prompts/systemPrompt.js` (functionality moved to `PromptBuilderService`)
*   `prompts/base/departments_EN.js` (moved to `data/departments/`)
*   `prompts/base/departments_FR.js` (moved to `data/departments/`)
*   `prompts/base/menuStructure_EN.js` (moved to `data/menuStructure/`)
*   `prompts/base/menuStructure_FR.js` (moved to `data/menuStructure/`)

## Benefits

*   **Improved Maintainability:** Easier to locate and update specific prompt sections.
*   **Enhanced Testability:** Direct support for injecting test prompts.
*   **Clearer Logic:** Single, well-defined workflow for the agent.
*   **Better Tool Alignment:** Instructions accurately reflect available tools and usage.
*   **Reduced Redundancy:** Eliminates duplicated logic.
