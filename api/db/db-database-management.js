import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import dbConnect from './db-connect.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';
import mongoose from 'mongoose';
import fs from 'fs';
import crypto from 'crypto'; // Import crypto for generating UUIDs

async function databaseManagementHandler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const connection = await dbConnect();
    
    // Get all registered models from Mongoose
    const collections = Object.keys(mongoose.models).reduce((acc, modelName) => {
      acc[modelName.toLowerCase()] = mongoose.models[modelName];
      return acc;
    }, {});

    if (req.method === 'GET') {
      // Chunked export support with date range
      const { collection, skip = 0, limit = 1000, startDate, endDate } = req.query;
      // Always use 'updatedAt' as the date field
      const dateField = 'updatedAt';
      if (!collection) {
        // Return list of available collections
        return res.status(200).json({
          collections: Object.keys(collections)
        });
      }
      const model = collections[collection.toLowerCase()];
      if (!model) {
        return res.status(400).json({ message: `Collection '${collection}' not found` });
      }
      // Build date filter if provided
      let dateFilter = {};
      // Only apply date filter if the model schema has updatedAt
      const hasUpdatedAt = model.schema && model.schema.paths && model.schema.paths.updatedAt;
      if ((startDate || endDate) && hasUpdatedAt) {
        dateFilter[dateField] = {};
        if (startDate) dateFilter[dateField].$gte = new Date(startDate);
        if (endDate) dateFilter[dateField].$lte = new Date(endDate);
      }
      // Paginated export for a single collection with optional date filter
      const docs = await model.find(dateFilter)
        .sort({ _id: 1 }) // Ensure consistent ordering between chunks
        .skip(Number(skip))
        .limit(Number(limit))
        .lean();
      const total = await model.countDocuments(dateFilter);
      return res.status(200).json({
        collection,
        total,
        skip: Number(skip),
        limit: Number(limit),
        data: docs
      });
    } else if (req.method === 'POST') {
      // Only support chunked upload
      const { chunkIndex, totalChunks, fileName } = req.body;
      const chunk = req.files?.chunk;

      if (chunk && chunkIndex !== undefined && totalChunks !== undefined && fileName) {
        try {
          // Assume chunk.data is a Buffer containing only complete lines (JSONL)
          const chunkText = chunk.data.toString();
          const lines = chunkText.split(/\r?\n/).filter(line => line.trim().startsWith('{'));

          // Initialize stats for this chunk
          let stats = { inserted: 0, failed: 0 };

          // Process all complete lines in this chunk
          await processLines(lines, collections, stats);

          // If this is the last chunk, the client should have sent any remaining incomplete line as a complete line
          const responsePayload = {
            message: `Chunk ${parseInt(chunkIndex) + 1} of ${totalChunks} uploaded and processed`,
            stats
          };

          if (parseInt(chunkIndex) + 1 === parseInt(totalChunks)) {
            responsePayload.message = 'Database import completed.';
          }
          return res.status(200).json(responsePayload);
        } catch (err) {
          console.error('Error processing chunk:', err);
          return res.status(500).json({ message: 'Error processing upload chunk', error: err.message });
        }
      }
      // If not chunked upload, return error
      return res.status(400).json({ message: 'Chunked upload required. Missing chunk, chunkIndex, totalChunks, or fileName.' });
    } else if (req.method === 'DELETE') {
      // Drop all indexes
      const results = {
        success: [],
        failed: []
      };

      await Promise.all(Object.values(collections).map(async model => {
        try {
          await model.collection.dropIndexes();
          results.success.push(model.modelName);
          console.log(`Dropped indexes for ${model.modelName}`);
        } catch (error) {
          results.failed.push({
            collection: model.modelName,
            error: error.message
          });
          console.warn(`Error dropping indexes for ${model.modelName}:`, error.message);
        }
      }));

      return res.status(200).json({ 
        message: 'Database indexes dropped successfully',
        results
      });
    }
  } catch (error) {
    console.error('Database management error:', error);
    return res.status(500).json({ 
      message: 'Database operation failed', 
      error: error.message 
    });
  }
}

async function processLines(lines, collections, stats) {
  // Group operations by collection for bulk processing
  const operationsByCollection = {};
  
  // Prepare bulk operations
  for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
      const { collection, doc } = JSON.parse(line);
      const collectionName = collection.toLowerCase();
      
      if (!collections[collectionName]) {
        stats.failed++;
        continue;
      }
      
      // Initialize operations array for this collection if needed
      if (!operationsByCollection[collectionName]) {
        operationsByCollection[collectionName] = [];
      }
      
      // Add upsert operation (creates if not exists, updates if exists)
      operationsByCollection[collectionName].push({
        updateOne: {
          filter: { _id: doc._id },
          update: doc,
          upsert: true
        }
      });
      
    } catch (err) {
      stats.failed++;
      console.error('Import parsing error:', err.message);
    }
  }
  
  // Execute bulk operations for each collection
  const BATCH_SIZE = 500; // Optimal batch size for MongoDB
  
  for (const [collectionName, operations] of Object.entries(operationsByCollection)) {
    const model = collections[collectionName];
    
    try {
      // Process in optimized batches
      for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = operations.slice(i, i + BATCH_SIZE);
        const result = await model.bulkWrite(batch, { ordered: false });
        
        // Update stats with batch results
        stats.inserted += (result.upsertedCount + result.modifiedCount);
      }
    } catch (err) {
      stats.failed += operations.length;
      console.error(`Bulk import error for ${collectionName}:`, err.message);
    }
  }
}

export default function handler(req, res) {
  return withProtection(databaseManagementHandler, authMiddleware, adminMiddleware)(req, res);
}