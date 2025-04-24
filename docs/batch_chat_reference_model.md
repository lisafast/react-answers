# Batch–Chat Refactor Plan

This document outlines the proposed design for a two-tier model in which a Batch references one-to-many Chat documents. It covers schema changes, services/refactoring, API endpoints, UI updates, and migration steps.

---

## 1. Overview

- **Batch**: Represents a high-level job containing metadata plus an ordered list of Chat runs.
- **Chat**: Reuses the existing Chat model and processing logic for each record.
- Batch processing orchestrates multiple Chat instances, driving them sequentially or in timed slices via existing ChatProcessingService APIs.

## 2. Models

### Batch Schema (`models/batch.js`)
- Add a `chats: [{ type: ObjectId, ref: 'Chat' }]` field.
- Keep batch metadata: `name`, `type`, `aiProvider`, `searchProvider`, `pageLanguage`, `applyOverrides`, counts (`totalItems`, `processedItems`, `failedItems`), `status`, `lastProcessedIndex`.
- Optionally remove inline `entries` and `interactions` arrays if raw records are not stored in Batch.

### Chat Schema (`models/chat.js`)
- **No changes** to core processing fields (`chatId`, `interactions`, `aiProvider`, `searchProvider`, `pageLanguage`).
- Each Chat run maintains its own interaction history using standard ChatProcessingService.

## 3. Service Refactoring

### BatchProcessingService
- **createBatchRun**: creates a Batch document, then for each input record:
  1. Instantiate a Chat via `Chat.create({ chatId, aiProvider, searchProvider, pageLanguage, applyOverrides, uploaderUserId })`.
  2. Push Chat `_id` into `batch.chats`.
- **processForDuration**: load Batch & slice `batch.chats` from `lastProcessedIndex`, then for each chatId invoke `ChatProcessingService.processMessage({ chatId, ... })`.
- Persist progress by updating `batch.processedItems`, `batch.failedItems`, `batch.lastProcessedIndex`, and `batch.status`.

### ChatProcessingService
- **No changes** to `processMessage` or streaming logic.
- Continues to handle a single chat session.

## 4. API Routes (`api/batch/`)

- `POST /api/batch/create` → calls `BatchProcessingService.createBatchRun(...)`, returns `batchId`.
- `POST /api/batch/process-for-duration` → accepts `{ batchId }`, invokes batch-level duration runner.
- `POST /api/batch/cancel` → marks batch as cancelled.
- `GET  /api/batch/list` → returns list of Batch docs (with populated number of chats & progress).
- `GET  /api/batch/results` → loads Batch, populates Chats and their interactions, merges into CSV/JSON.

## 5. UI Changes

- **BatchUpload.js**
  - `POST /api/batch/create` with original form data.
  - Store returned `batchId`.

- **BatchPage.js**
  - Poll `GET /api/batch/list`.
  - Resume/start with `POST /api/batch/process-for-duration`.
  - Download via `GET /api/batch/results?batchId=...`.
  - Display `processedItems` / `totalItems`, `status`.

- **BatchList.js**
  - Render batch-level metrics.
  - No per-Chat UI needed unless drill-down is desired.

## 6. Migration & Deployment

1. **Data Migration Script**
   - Read existing `Batch` docs and copy their inline entries & stats into new Batch schema if changed.
   - Optionally create Chat docs for future records if you want full history.
2. **Remove old inline batch entries**
3. **Drop unused fields / models** (if any).
4. **Update tests** to cover new API & service flows.
5. **Staged rollout**: deploy backend & run migration, then update frontend.

---

*Document generated on {{DATE}}*
