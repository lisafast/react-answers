
import express from 'express';
import cors from 'cors';
import path from 'path';
import fileUpload from 'express-fileupload';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import openAIHandler from '../api/openai/openai-message.js';
import azureHandler from '../api/azure/azure-message.js';
import azureContextHandler from '../api/azure/azure-context.js';
import azureBatchProcessResultsHandler from '../api/azure/azure-batch-process-results.js';
import anthropicAgentHandler from '../api/anthropic/anthropic-message.js';
import dbChatLogsHandler from '../api/db/db-chat-logs.js';
import anthropicBatchHandler from '../api/anthropic/anthropic-batch.js';
import openAIBatchHandler from '../api/openai/openai-batch.js';
import anthropicBatchStatusHandler from '../api/anthropic/anthropic-batch-status.js';
import openAIBatchStatusHandler from '../api/openai/openai-batch-status.js';
import contextSearchHandler from '../api/search/search-context.js';
import anthropicBatchContextHandler from '../api/anthropic/anthropic-batch-context.js';
import openAIBatchContextHandler from '../api/openai/openai-batch-context.js';
import dbBatchListHandler from '../api/db/db-batch-list.js';
import anthropicBatchProcessResultsHandler from '../api/anthropic/anthropic-batch-process-results.js';
import openAIBatchProcessResultsHandler from '../api/openai/openai-batch-process-results.js';
import dbBatchRetrieveHandler from '../api/db/db-batch-retrieve.js';
import anthropicBatchCancelHandler from '../api/anthropic/anthropic-batch-cancel.js';
import openAIBatchCancelHandler from '../api/openai/openai-batch-cancel.js';
import anthropicContextAgentHandler from '../api/anthropic/anthropic-context.js';
import openAIContextAgentHandler from '../api/openai/openai-context.js';
import dbChatSessionHandler from '../api/db/db-chat-session.js';
import dbVerifyChatSessionHandler from '../api/db/db-verify-chat-session.js';
import dbCheckhandler from '../api/db/db-check.js';
// import dbPersistInteraction from '../api/db/db-persist-interaction.js'; // Removed - handled by ChatProcessingService
import dbPersistFeedback from '../api/db/db-persist-feedback.js';
import dbLogHandler from '../api/db/db-log.js';
import signupHandler from '../api/db/db-auth-signup.js';
import loginHandler from '../api/db/db-auth-login.js';
import dbConnect from '../api/db/db-connect.js';
import dbUsersHandler from '../api/db/db-users.js';
import deleteChatHandler from '../api/db/db-delete-chat.js';
import generateEmbeddingsHandler from '../api/db/db-generate-embeddings.js';
import generateEvalsHandler from '../api/db/db-generate-evals.js';
import dbDatabaseManagementHandler from '../api/db/db-database-management.js';
import chatHandler from '../api/chat/chat.js';
import createBatchHandler from '../api/batch/create.js'; // Added batch create handler
import batchStatusHandler from '../api/batch/status.js'; // Added batch status handler

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(fileUpload());
app.use(express.static(path.join(__dirname, "../build")));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} request to ${req.url}`);
  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "Healthy" });
});

app.get("*", (req, res, next) => {
  if (req.url.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(__dirname, "../build", "index.html"));
});

app.post('/api/db/db-persist-feedback', dbPersistFeedback);
// app.post('/api/db/db-persist-interaction', dbPersistInteraction); // Removed route
app.get('/api/db/db-chat-session', dbChatSessionHandler);
app.get('/api/db/db-verify-chat-session', dbVerifyChatSessionHandler);
app.get('/api/db/db-batch-list', dbBatchListHandler);
app.get('/api/db/db-batch-retrieve', dbBatchRetrieveHandler);
app.get('/api/db/db-check', dbCheckhandler);
app.post('/api/db/db-log', dbLogHandler);
app.get('/api/db/db-log', dbLogHandler);
app.get('/api/db/db-chat-logs', dbChatLogsHandler);
app.post('/api/db/db-auth-signup', signupHandler);
app.post('/api/db/db-auth-login', loginHandler);
app.all('/api/db/db-users', dbUsersHandler);
app.delete('/api/db/db-delete-chat', deleteChatHandler);
app.post('/api/db/db-generate-embeddings', generateEmbeddingsHandler);
app.post('/api/db/db-generate-evals', generateEvalsHandler);
app.all('/api/db/db-database-management', dbDatabaseManagementHandler);

app.post("/api/openai/openai-message", openAIHandler);
app.post("/api/openai/openai-context", openAIContextAgentHandler);
app.post('/api/openai/openai-batch', openAIBatchHandler);
app.post('/api/openai/openai-batch-context', openAIBatchContextHandler);
app.get('/api/openai/openai-batch-process-results', openAIBatchProcessResultsHandler);
app.get('/api/openai/openai-batch-status', openAIBatchStatusHandler);
app.get('/api/openai/openai-batch-cancel', openAIBatchCancelHandler);

app.post('/api/anthropic/anthropic-message', anthropicAgentHandler);
app.post('/api/anthropic/anthropic-context', anthropicContextAgentHandler);
app.post('/api/anthropic/anthropic-batch', anthropicBatchHandler);
app.post('/api/anthropic/anthropic-batch-context', anthropicBatchContextHandler);
app.get('/api/anthropic/anthropic-batch-process-results', anthropicBatchProcessResultsHandler);
app.get('/api/anthropic/anthropic-batch-status', anthropicBatchStatusHandler);
app.get('/api/anthropic/anthropic-batch-cancel', anthropicBatchCancelHandler);

app.post("/api/azure/azure-message", azureHandler);  // Updated Azure endpoint
app.post("/api/azure/azure-context", azureContextHandler);
//app.post('/api/azure/azure-batch', azureBatchHandler);
//app.get('/api/azure/azure-batch-status', azureBatchStatusHandler);
//app.post('/api/azure/azure-batch-context', azureBatchContextHandler);
//app.get('/api/azure/azure-batch-cancel', azureBatchCancelHandler);
//app.get('/api/azure-batch-process-results', azureBatchProcessResultsHandler);

app.post('/api/search/search-context', contextSearchHandler);
app.post('/api/chat/chat', chatHandler); // Keep existing chat handler (now refactored)

// Add new batch routes
app.post('/api/batch/create', createBatchHandler);
app.get('/api/batch/status', batchStatusHandler);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

fetch("http://localhost:3001/health")
  .then((response) => response.json())
  .then((data) => console.log("Health check:", data))
  .catch((error) => console.error("Error:", error));
