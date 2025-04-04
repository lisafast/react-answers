# Backend Architecture Overview

This document outlines the proposed backend architecture for the chat application, focusing on a service-oriented approach to improve modularity, testability, and maintainability.

## Core Principles

*   **Models Define Structure:** Models (`models/*.js`) strictly define the data schema for database persistence (Mongoose). They do not contain complex business logic.
*   **Services Handle Logic:** Services (`services/*.js`) encapsulate specific business logic domains (e.g., external API interaction, workflow orchestration, database operations).
*   **Clear Data Flow:** Data passed between layers and services is well-defined, typically using structured objects. Persistence operations use data mapped explicitly to model schemas.
*   **Agent Layer:** Handles complex reasoning, tool usage, and context management required for generating high-quality AI responses.
*   **API Layer:** Provides the HTTP interface, handles request/response cycles, authentication, and delegates business logic to services.

## Backend Layers

1.  **API Layer (`api/`)**: Handles incoming HTTP requests, performs validation/auth, calls appropriate services, and formats/sends HTTP responses. Examples: `api/chat/message.js`, `api/batch/create.js`.
2.  **Service Layer (`services/`)**: Contains the core business logic. Services are typically stateless and focus on specific tasks.
3.  **Agent Layer (`agents/`)**: Implements the logic for AI interaction, including context gathering, tool usage, and prompt engineering. Invoked by services like `ChatProcessingService`.
4.  **Data Layer (`models/`)**: Defines Mongoose schemas for database documents.

## Core Backend Services

*   **`AnswerService` (`services/AnswerService.js`)**:
    *   **Responsibility:** Interact directly with specific AI provider APIs (e.g., Anthropic, OpenAI, Azure).
    *   Prepare API-specific request payloads.
    *   Send requests to the AI provider for single messages and potentially batch jobs (if using provider's native batch).
    *   Receive raw responses from the AI provider.
    *   **Parse** the provider-specific response format (e.g., extracting content, metadata, tool calls, citations from XML-like structures) into a standardized JavaScript object.
    *   Return the parsed, structured data object.

*   **`DataStoreService` (New Backend Service - e.g., `services/DataStoreService.js`)**:
    *   **Responsibility:** Abstract all direct interactions with the MongoDB database.
    *   Provide methods to create, read, update, and delete documents for all relevant models (`Chat`, `Interaction`, `Answer`, `Question`, `Context`, `Citation`, `Tool`, `BatchRun`, `User`, etc.).
    *   Handle database connection logic.
    *   Take structured data objects from other services and save them correctly according to the Mongoose schemas.

*   **`ChatProcessingService` (New Backend Service - e.g., `services/ChatProcessingService.js`)**:
    *   **Responsibility:** Orchestrate the end-to-end workflow for processing a single user message.
    *   Retrieve chat history via `DataStoreService`.
    *   Perform preprocessing (redaction, moderation).
    *   Invoke the Agent Layer (`agents/`).
    *   Receive the parsed response object from the Agent Layer.
    *   Perform post-processing (e.g., citation verification).
    *   Call `DataStoreService.persistInteraction` with the final structured data.
    *   Trigger other services like `EmbeddingService` or `EvaluationService`.
    *   Return the final, user-facing response data.

*   **`BatchProcessingService` (New Backend Service - e.g., `services/BatchProcessingService.js`)**:
    *   **Responsibility:** Manage the lifecycle of batch processing jobs using a background job queue for consistency.
    *   Receive batch creation requests.
    *   Call `DataStoreService` to create/update `BatchRun` documents.
    *   Add individual jobs (one per batch item) to a background queue (e.g., BullMQ). Each job contains item data and the `batchRunId`.
    *   (Background workers execute these jobs).

*   **`EmbeddingService` (`services/EmbeddingService.js`)**:
    *   **Responsibility:** Generate vector embeddings for interactions or other text data.

*   **`EvaluationService` (`services/EvaluationService.js`)**:
    *   **Responsibility:** Perform automated evaluations on saved interactions.

*   **`ServerLoggingService` (`services/ServerLoggingService.js`)**:
    *   **Responsibility:** Handle backend logging operations.

*   **`AuthService` (Backend Version)**:
    *   **Responsibility:** Handle user authentication, authorization, and potentially API key management for backend operations.

## Request Flows

### Single Message Processing

```mermaid
sequenceDiagram
    participant Frontend
    participant API Layer (e.g., /api/chat/message)
    participant ChatProcessingService
    participant AgentLayer
    participant AnswerService
    participant DataStoreService

    Frontend->>+API Layer: Send message, chatId, etc.
    API Layer->>+ChatProcessingService: processMessage(data)
    ChatProcessingService->>+DataStoreService: getChatHistory(chatId)
    DataStoreService-->>-ChatProcessingService: history
    ChatProcessingService->>+AgentLayer: invokeAgent(message, history, config)
    AgentLayer->>+AnswerService: sendMessage(prompt, context)
    AnswerService-->>-AgentLayer: parsedResponse
    AgentLayer-->>-ChatProcessingService: agentResult (incl. parsedResponse)
    ChatProcessingService->>ChatProcessingService: Perform post-processing (e.g., citation check)
    ChatProcessingService->>+DataStoreService: persistInteraction(structuredData)
    DataStoreService-->>-ChatProcessingService: persistenceResult
    ChatProcessingService-->>-API Layer: finalUserResponse
    API Layer-->>-Frontend: Send response
```

### Batch Processing (Job Queue Approach)

```mermaid
sequenceDiagram
    participant Frontend
    participant API Layer (e.g., /api/batch/create)
    participant BatchProcessingService
    participant DataStoreService
    participant JobQueue
    participant JobWorker
    participant ChatProcessingService # Same service as single message

    Frontend->>+API Layer: Send batch definition (items, config)
    API Layer->>+BatchProcessingService: queueBatchRun(batchDefinition)
    BatchProcessingService->>+DataStoreService: createBatchRun(definition)
    DataStoreService-->>-BatchProcessingService: batchRunId
    loop For each item in batch
        BatchProcessingService->>+JobQueue: addJob(itemData, config, batchRunId)
    end
    BatchProcessingService-->>-API Layer: batchRunId
    API Layer-->>-Frontend: batchRunId (for status polling)

    Note right of JobQueue: Background Processing Starts
    JobWorker->>+JobQueue: getNextJob()
    JobQueue-->>-JobWorker: job(itemData, config, batchRunId)
    JobWorker->>+ChatProcessingService: processMessage(itemData) # Reuse single message logic!
    ChatProcessingService-->>-JobWorker: processingResult
    JobWorker->>+DataStoreService: persistInteraction(processingResult, batchRunId) # Link interaction to batch
    DataStoreService-->>-JobWorker: persistenceResult
    JobWorker->>+DataStoreService: updateBatchRunProgress(batchRunId)
    DataStoreService-->>-JobWorker: updateResult
    JobWorker->>JobWorker: Mark job complete
```

This architecture aims to provide a robust, scalable, and maintainable backend structure.
