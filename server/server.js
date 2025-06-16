// server/server.js - this is only used for local development NOT for Vercel
import express from 'express';
import cors from 'cors';
import path from 'path';
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
import dbPersistInteraction from '../api/db/db-persist-interaction.js';
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
import dbDeleteSystemLogsHandler from '../api/db/db-delete-system-logs.js';
import dbSettingsHandler from '../api/db/db-settings.js';
import dbPublicSiteStatusHandler from '../api/db/db-public-site-status.js';
import dbExpertFeedbackCountHandler from '../api/db/db-expert-feedback-count.js';
import dbTableCountsHandler from '../api/db/db-table-counts.js';
import dbRepairTimestampsHandler from '../api/db/db-repair-timestamps.js';
import dbRepairExpertFeedbackHandler from '../api/db/db-repair-expert-feedback.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();

// Unified CORS setup for all environments
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from your frontend development server and your production frontend URL
    // In development, with the proxy, the 'origin' header might be that of the proxy itself or undefined.
    // For proxied requests, the browser sees it as same-origin, so this check might be more relevant for direct API calls if any.
    // If you have a specific production frontend URL, add it to the allowedOrigins array.
    // Example: const allowedOrigins = ['http://localhost:3000', 'https://your-production-frontend.com'];
    // For now, reflecting the origin if it exists, or allowing if no origin (e.g. server-to-server, or proxied same-origin)
    if (!origin || (origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000')) { // Adjust if your prod frontend URL is known
      callback(null, true);
    } else {
      // For a stricter approach, define allowedOrigins and check against them:
      // const allowedOrigins = ['https://your-production-frontend.com']; // Add your actual production frontend URL
      // if (allowedOrigins.includes(origin)) {
      //   callback(null, true);
      // } else {
      //   callback(new Error('Not allowed by CORS'));
      // }
      // Temporarily using a more permissive approach for proxied dev and general prod:
      callback(null, true); // Reflect origin
    }
  },
  credentials: true
}));
console.log('CORS configured with credentials support.');

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "../build")));

// Set higher timeout limits for all routes
app.use((req, res, next) => {
  // Set timeout to 5 minutes
  req.setTimeout(300000);
  res.setTimeout(300000);
  next();
});

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
app.get('/api/db/db-public-site-status', dbPublicSiteStatusHandler);
app.post('/api/db/db-persist-feedback', dbPersistFeedback);
app.post('/api/db/db-persist-interaction', dbPersistInteraction);
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
app.delete('/api/db/db-delete-system-logs', dbDeleteSystemLogsHandler);
app.all('/api/db/db-settings', dbSettingsHandler);
app.get('/api/db/db-expert-feedback-count', dbExpertFeedbackCountHandler);
app.get('/api/db/db-table-counts', dbTableCountsHandler);
app.post('/api/db/db-repair-timestamps', dbRepairTimestampsHandler);
app.post('/api/db/db-repair-expert-feedback', dbRepairExpertFeedbackHandler);

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


const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

fetch("http://localhost:3001/health")
  .then((response) => response.json())
  .then((data) => console.log("Health check:", data))
  .catch((error) => console.error("Error:", error));
