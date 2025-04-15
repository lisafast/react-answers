import express from 'express';
import cors from 'cors';
import path from 'path';
import fileUpload from 'express-fileupload';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

import dbChatLogsHandler from '../api/db/db-chat-logs.js';
import dbChatSessionHandler from '../api/db/db-chat-session.js';
import dbVerifyChatSessionHandler from '../api/db/db-verify-chat-session.js';
import dbCheckhandler from '../api/db/db-check.js';
import dbPersistFeedback from '../api/db/db-persist-feedback.js';
import dbLogHandler from '../api/db/db-log.js';
import signupHandler from '../api/db/db-auth-signup.js';
import loginHandler from '../api/db/db-auth-login.js';
import dbUsersHandler from '../api/db/db-users.js';
import deleteChatHandler from '../api/db/db-delete-chat.js';
import generateEmbeddingsHandler from '../api/db/db-generate-embeddings.js';
import generateEvalsHandler from '../api/db/db-generate-evals.js';
import dbDatabaseManagementHandler from '../api/db/db-database-management.js';
import chatHandler from '../api/chat/chat.js';
import { createBatchHandler, listBatchesHandler, getBatchResultsHandler, batchStatusHandler, cancelBatchHandler } from '../api/batch/index.js';
// Import prompt API handlers
import promptListHandler from '../api/prompts/list.js';
import promptGetHandler from '../api/prompts/get.js';
import promptSaveHandler from '../api/prompts/save.js';
import promptStatusHandler from '../api/prompts/status.js';
import promptDeleteHandler from '../api/prompts/delete.js';
import processForDurationHandler from '../api/batch/process-for-duration.js';


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
app.get('/api/db/db-chat-session', dbChatSessionHandler);
app.get('/api/db/db-verify-chat-session', dbVerifyChatSessionHandler);
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



app.post('/api/chat/chat', chatHandler); // Keep existing chat handler (now refactored)

// Add new batch routes
app.post('/api/batch/create', createBatchHandler);
app.get('/api/batch/status', batchStatusHandler);
app.get('/api/batch/list', listBatchesHandler);
app.get('/api/batch/results', getBatchResultsHandler);
app.post('/api/batch/cancel', cancelBatchHandler);
app.post('/api/batch/process-for-duration', processForDurationHandler); // New route added here

// Add new prompt management routes with specific paths (protection applied in handlers)
app.get('/api/prompts/list', promptListHandler);
app.post('/api/prompts/get', promptGetHandler);
app.put('/api/prompts/save', promptSaveHandler);
app.patch('/api/prompts/status', promptStatusHandler);
app.delete('/api/prompts/delete', promptDeleteHandler);


const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

fetch("http://localhost:3001/health")
  .then((response) => response.json())
  .then((data) => console.log("Health check:", data))
  .catch((error) => console.error("Error:", error));
