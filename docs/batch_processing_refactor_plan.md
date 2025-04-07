# Batch Processing Refactor Plan

**Version:** 1.0
**Date:** 2025-04-07

## 1. Goals

*   Refactor the batch processing system to utilize the existing `services/ChatProcessingService.js` for consistency between single chat interactions and batch item processing.
*   Consolidate provider-specific batch API endpoints into a unified set under `/api/batch/`.
*   Ensure the solution is deployable on both Vercel (serverless) and locally via `server/server.js`.
*   Minimize backend schema changes, limiting modifications primarily to `models/batch.js`.
*   Update the existing React UI (`src/components/batch/`, `src/pages/BatchPage.js`) to interact with the new API endpoints.

## 2. Key Decisions & Constraints

*   **Schema Changes:** Only `models/batch.js` will be modified. `models/chat.js` and `models/interaction.js` remain unchanged.
*   **Processing:** Batch items will be processed **sequentially** in the initial implementation. Parallel processing can be considered later as a performance enhancement.
*   **Chat Grouping:** The input CSV can optionally contain a `chatId` column. Rows sharing the same `chatId` will be processed as part of the same conversation, preserving history context. Rows without a `chatId` or with unique IDs will initiate new, independent chat sessions.
*   **Error Handling:** If processing an individual item fails, the error will be logged, the batch's `failedItems` count incremented, and processing will continue with the next item.
*   **User Context:** The batch processing will respect the context of the user who uploaded the batch, including AI provider, search provider, language, and optionally their active prompt overrides.

## 3. Implementation Steps

### 3.1. Backend - Schema Modification (`models/batch.js`)

*   **Objective:** Enhance the `Batch` schema to store necessary configuration and context.
*   **Action:** Modify `models/batch.js`.
*   **Changes:**
    *   Add `uploaderUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }` - To link the batch to the uploading user.
    *   Add `applyOverrides: { type: Boolean, default: false, required: true }` - To indicate if the uploader's prompt overrides should be used.
    *   Add `searchProvider: { type: String, required: true }` - To store the selected search provider for the batch.
    *   Ensure existing fields (`status`, `batchId`, `type`, `name`, `aiProvider`, `pageLanguage`, `totalItems`, `processedItems`, `failedItems`, `interactions`) are suitable. `interactions` will store the `ObjectId`s of the `Interaction` documents created by processing each row.

### 3.2. Backend - New API Endpoints (`api/batch/`)

*   **Objective:** Create unified, serverless-compatible API endpoints for batch operations.
*   **Actions:**
    *   Create directory `api/batch/`.
    *   Implement the following handlers (using `withProtection` for auth):
        *   **`create.js` (POST):**
            *   Requires authentication (`authMiddleware`).
            *   Expects `multipart/form-data` containing the CSV file and form fields: `batchName`, `aiProvider`, `searchProvider`, `lang`, `applyOverrides` (boolean).
            *   Parses the CSV file (using `xlsx` or similar). Validate required columns (`REDACTEDQUESTION` or similar, optional `chatId`, `URL`).
            *   Creates a new `Batch` document in the database:
                *   Set initial `status` (e.g., 'queued' or 'preprocessing').
                *   Store `batchName`, `aiProvider`, `searchProvider`, `pageLanguage` (`lang`).
                *   Store `uploaderUserId` (from `req.user._id`).
                *   Store `applyOverrides`.
                *   Set `totalItems` based on valid rows in CSV.
                *   Initialize `processedItems: 0`, `failedItems: 0`.
            *   **Asynchronously** trigger the `BatchExecutionService` to start processing (e.g., using a simple in-memory queue for local dev, or a more robust queue for production/Vercel). *Do not block the API response.*
            *   Returns `{ batchId: newBatch._id }` with status 202 (Accepted).
        *   **`status.js` (GET):**
            *   Requires authentication.
            *   Expects `batchId` as a query parameter.
            *   Fetches the `Batch` document by `_id`.
            *   Verify the requesting user has permission to view this batch (e.g., matches `uploaderUserId`).
            *   Returns relevant fields: `status`, `totalItems`, `processedItems`, `failedItems`, `createdAt`, `updatedAt`, `name`, `aiProvider`, `searchProvider`, `pageLanguage`.
        *   **`list.js` (GET):**
            *   Requires authentication.
            *   Fetches all `Batch` documents where `uploaderUserId` matches `req.user._id`.
            *   Returns an array of batch summaries (similar fields to `status.js`).
        *   **`results.js` (GET):**
            *   Requires authentication.
            *   Expects `batchId` as a query parameter.
            *   Fetches the `Batch` document, verifying permissions.
            *   Populates the `interactions` array (fetching associated `Interaction` documents).
            *   Formats the results (e.g., as JSON initially, potentially adding CSV/Excel export later). This involves mapping `Interaction` fields back to a structured format.
            *   Returns the formatted results.
        *   **`cancel.js` (POST or DELETE):**
            *   Requires authentication.
            *   Expects `batchId` as a query parameter or body parameter.
            *   Fetches the `Batch` document, verifying permissions.
            *   Checks if the batch is in a cancellable state (e.g., 'queued', 'processing').
            *   Updates the `Batch` status to 'cancelled'.
            *   (Optional: Signal the `BatchExecutionService` to stop processing if currently active).
            *   Returns success status (e.g., 200 OK).
    *   **Register Routes:** Add these new routes in `server/server.js`.
    *   **Remove Old Routes:** Delete the old provider-specific batch routes (`/api/openai/openai-batch*`, `/api/anthropic/anthropic-batch*`, etc.) from `server/server.js`.

### 3.3. Backend - Processing Logic (`services/BatchExecutionService.js`)

*   **Objective:** Implement the core sequential processing logic for batch items.
*   **Actions:**
    *   Create `services/BatchExecutionService.js`.
    *   Define an async function `processBatch(batchId)`. This function will be triggered by the `create.js` API handler.
    *   **Inside `processBatch(batchId)`:**
        *   Fetch the full `Batch` document using `batchId`.
        *   Update `Batch` status to 'processing'.
        *   Retrieve/parse the associated CSV data (needs to be stored temporarily or accessible).
        *   Group rows based on the `chatId` column.
        *   Initialize `processedCount = 0`, `failedCount = 0`.
        *   **Loop sequentially through each row/item:**
            *   Check for cancellation signal (if implemented).
            *   Determine the target `chatId` for this item based on the CSV column value.
            *   Prepare parameters for `ChatProcessingService.processMessage`:
                *   `chatId`: Determined from CSV or `undefined` if new chat needed.
                *   `userMessage`: From CSV 'REDACTEDQUESTION' column.
                *   `lang`: From `Batch.pageLanguage`.
                *   `selectedAI`: From `Batch.aiProvider`.
                *   `selectedSearch`: From `Batch.searchProvider`.
                *   `referringUrl`: From CSV 'URL' column (if present).
                *   `user`: Fetched user object based on `Batch.uploaderUserId`.
                *   `overrideUserId`: Set to `Batch.uploaderUserId` if `Batch.applyOverrides` is true, else `null`.
            *   **`try...catch` block around the call:**
                *   `const interactionResult = await ChatProcessingService.processMessage(params);`
                *   **On Success:**
                    *   Increment `processedCount`.
                    *   Push `interactionResult.interactionId` to a temporary array.
                    *   Periodically (e.g., every 10 items) update the `Batch` document in DB: `Batch.updateOne({ _id: batchId }, { $set: { processedItems: processedCount }, $push: { interactions: { $each: temporaryInteractionIds } } });` Clear the temporary array.
                *   **On Failure (catch error):**
                    *   Increment `failedCount`.
                    *   Log the error details (including row info and `batchId`).
                    *   Update `Batch` document: `Batch.updateOne({ _id: batchId }, { $set: { failedItems: failedCount } });`
        *   **After loop:**
            *   Perform one final update for any remaining interactions in the temporary array.
            *   Determine final status: 'processed' if `failedCount === 0`, 'completed_with_errors' otherwise.
            *   Update `Batch` document with final `status`, `processedItems`, `failedItems`.

### 3.4. Frontend - UI Updates

*   **Objective:** Modify React components to use the new API endpoints and accommodate new settings.
*   **Actions:**
    *   **`src/components/batch/BatchUpload.js`:**
        *   Add a checkbox input for "Apply my active prompt overrides". Manage its state.
        *   Modify `handleUpload` / `handleProcessFile` (or combine):
            *   Gather all settings: `batchName`, `selectedAI`, `selectedSearch`, `selectedLanguage`, `applyOverrides` state, and the file.
            *   Use `fetch` to call the **new** `POST /api/batch/create` endpoint, sending data as `multipart/form-data`.
            *   Handle the 202 Accepted response, potentially storing the returned `batchId`.
            *   Update UI feedback (e.g., "Batch submitted with ID: ...").
            *   Remove calls to old `MessageService.sendBatchMessages` or similar.
    *   **`src/components/batch/BatchList.js`:**
        *   Modify `fetchBatches` (or equivalent polling logic):
            *   Call the **new** `GET /api/batch/list` to get the list of batches.
            *   For *each* batch in the list that is in a pending/processing state, periodically call the **new** `GET /api/batch/status?batchId={id}` to update its status display.
        *   Modify button action handlers:
            *   **Download (CSV/Excel):** Call the **new** `GET /api/batch/results?batchId={id}`. The formatting logic might move partially to the backend or stay in `ExportService` using the JSON response.
            *   **Cancel:** Call the **new** `POST /api/batch/cancel` (or DELETE) with the `batchId`.
            *   **Process (for 'completed' status):** This button's purpose needs review. It likely should become a "View/Download Results" button triggering the same action as Download. Remove calls to old `batch-process-results` endpoints.
    *   **`src/pages/BatchPage.js`:**
        *   Update the `handleDownloadClick` and `handleCompleteCancelClick` functions to align with the changes made in `BatchList.js`, ensuring they call the correct new API endpoints. Remove any provider-specific logic.
    *   **`src/services/DataStoreService.js` / `src/utils/apiToUrl.js`:**
        *   Update or add functions to interact with the new `/api/batch/*` endpoints. Remove functions related to the old batch endpoints.

## 4. Testing Strategy

*   **General Approach:** Apply Test-Driven Development (TDD) principles throughout the implementation. Write tests using Vitest (`*.test.js` files) *before* writing the corresponding implementation code. Ensure tests cover both success paths and edge cases/error conditions.
*   **Unit Tests:**
    *   Test CSV parsing logic.
    *   Test `BatchExecutionService` logic (mocking `ChatProcessingService` and DB calls).
    *   Test API handler logic (mocking services and DB).
*   **Integration Tests:**
    *   Test the full flow from API call (`/api/batch/create`) through `BatchExecutionService` to `ChatProcessingService` and database updates for a small sample CSV.
    *   Test `chatId` grouping logic.
    *   Test error handling for individual items.
    *   Test status updates and results retrieval APIs.
*   **End-to-End Tests:**
    *   Simulate UI interaction: Upload a CSV, monitor status via polling, trigger download/cancel actions.

## 5. Deployment Considerations

*   **Vercel:** API handlers in `api/batch/` should work directly as serverless functions. The asynchronous triggering of `BatchExecutionService` needs careful consideration (e.g., Vercel Serverless Functions might have execution time limits, potentially requiring a background job queue like Vercel KV Queue, QStash, or external service if batches are very large/long-running). For initial sequential processing, running `BatchExecutionService` within the `create.js` function *after* sending the 202 response might be feasible if execution times are reasonable.
*   **Local (`server/server.js`):** The Express setup needs the new routes registered. Asynchronous triggering can be handled in-process (e.g., `setImmediate(() => BatchExecutionService.processBatch(batchId))`).

## 6. Rollout Plan (Simplified)

1.  Implement backend changes (Schema, API, Service).
2.  Implement frontend changes.
3.  Thorough testing (Unit, Integration, E2E) in a development environment.
4.  Deploy to staging (if available).
5.  Deploy to production.
6.  Monitor performance and error logs.
