# Architecture Decision: Using Server-Sent Events (SSE) for Agent Progress Streaming

**Date:** 2025-04-02

**Status:** Decided

## Context

The application's chat interface involves AI agents that can perform actions using tools (e.g., web searches, data lookups). These tool executions can take a noticeable amount of time. Currently, the UI waits until the entire agent process (including LLM calls and tool executions) is complete before displaying the final response. This can lead to a perceived lack of responsiveness.

## Problem

Users need better feedback during long-running agent operations to understand that the system is working and what it's doing (e.g., "Searching the web...", "Analyzing data...").

## Options Considered

1.  **No Streaming (Current):** Simple, but poor user experience for longer tasks.
2.  **WebSockets:** Provides full-duplex communication. Allows server-to-client and client-to-server messages over a persistent connection. More complex protocol (`ws://`, `wss://`) and implementation.
3.  **Server-Sent Events (SSE):** Provides one-way communication (server-to-client) over standard HTTP/HTTPS. Simpler to implement using the browser's built-in `EventSource` API. Well-suited for server push notifications and status updates.

## Decision

We will implement **Server-Sent Events (SSE)** for streaming agent progress updates from the backend (`/api/chat/chat.js`) to the frontend.

## Rationale

*   **Suitability:** SSE is ideal for this use case, as we primarily need the server to push updates (tool start/end, LLM chunks) *to* the client. Bi-directional communication (WebSockets) is not strictly required for this feature.
*   **Simplicity:** SSE is generally simpler to implement on both the server (using standard HTTP response headers and formatting) and the client (`EventSource` API) compared to WebSockets.
*   **Compatibility:** SSE is widely supported by modern browsers.
*   **Efficiency:** Uses standard HTTP/S, potentially leveraging existing infrastructure and connection handling more easily than a separate WebSocket protocol. Automatic reconnection is handled by the browser.
*   **Integration:** LangChain's LangGraph agents often support a `.stream()` method that yields intermediate events, which aligns well with the SSE model.

## Implementation Details

1.  Modify the `/api/chat/chat.js` endpoint to handle POST requests by establishing an SSE connection (`Content-Type: text/event-stream`).
2.  Utilize the agent's `.stream()` method instead of `.invoke()`.
3.  Iterate through the events yielded by the stream.
4.  Format relevant events (e.g., tool start/end identified via `ToolTrackingHandler` or similar callbacks surfaced in the stream, LLM response chunks) into SSE message format (`event: <type>\ndata: <json_payload>\n\n`).
5.  Send these messages over the response stream to the client.
6.  Send a final "end" event when the agent stream completes.
7.  Ensure existing authentication and CORS middleware protect the SSE endpoint.
8.  (Frontend) Update `ChatService.js` and UI components to use `EventSource` to connect to the endpoint and handle incoming events to update the UI state dynamically.

## Security Considerations

*   Authentication/Authorization: Apply existing API auth middleware.
*   HTTPS: Ensure traffic is encrypted.
*   CORS: Configure if frontend/backend origins differ.
*   Data Sensitivity: Avoid sending sensitive internal details in stream messages.

## Rate Limiting

*   Apply standard API rate limiting *before* establishing the SSE connection.
*   Message frequency within a stream is determined by agent execution speed; typically not an issue requiring specific rate limiting *within* the stream itself.
