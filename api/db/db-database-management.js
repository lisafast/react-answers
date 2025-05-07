import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import dbConnect from './db-connect.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';
import mongoose from 'mongoose';
import fs from 'fs';

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
      if (startDate || endDate) {
        dateFilter[dateField] = {};
        if (startDate) dateFilter[dateField].$gte = new Date(startDate);
        if (endDate) dateFilter[dateField].$lte = new Date(endDate);
      }
      // Paginated export for a single collection with optional date filter
      const docs = await model.find(dateFilter).skip(Number(skip)).limit(Number(limit)).lean();
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
        // Buffer to hold incomplete lines between chunks
        if (!global._jsonlImportBuffers) global._jsonlImportBuffers = {};
        if (!global._jsonlImportStats) global._jsonlImportStats = {};
        const bufferKey = `${fileName}`;
        let buffer = global._jsonlImportBuffers[bufferKey] || '';
        let stats = global._jsonlImportStats[bufferKey] || { inserted: 0, failed: 0 };
        buffer += chunk.data.toString();
        const lines = buffer.split(/\r?\n/);
        // If this is not the last chunk, keep the last (possibly incomplete) line in buffer
        if (parseInt(chunkIndex) + 1 < parseInt(totalChunks)) {
          buffer = lines.pop();
        } else {
          // On the last chunk, process all lines including the last one
          buffer = '';
        }
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const { collection, doc } = JSON.parse(line);
            const model = collections[collection.toLowerCase()];
            if (model && doc) {
              await model.create(doc);
              stats.inserted++;
            }
          } catch (err) {
            stats.failed++;
          }
        }
        // On the last chunk, if buffer is not empty, try to process it as a line
        if (parseInt(chunkIndex) + 1 === parseInt(totalChunks) && buffer.trim()) {
          try {
            const { collection, doc } = JSON.parse(buffer);
            const model = collections[collection.toLowerCase()];
            if (model && doc) {
              await model.create(doc);
              stats.inserted++;
            }
          } catch (err) {
            stats.failed++;
          }
        }
        global._jsonlImportBuffers[bufferKey] = buffer;
        global._jsonlImportStats[bufferKey] = stats;
        // If last chunk, clean up and return stats
        if (parseInt(chunkIndex) + 1 === parseInt(totalChunks)) {
          delete global._jsonlImportBuffers[bufferKey];
          const finalStats = global._jsonlImportStats[bufferKey];
          delete global._jsonlImportStats[bufferKey];
          return res.status(200).json({ message: 'Database imported successfully (JSONL streaming)', stats: finalStats });
        }
        return res.status(200).json({ message: `Chunk ${parseInt(chunkIndex) + 1} uploaded and processed` });
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

export default function handler(req, res) {
  return withProtection(databaseManagementHandler, authMiddleware, adminMiddleware)(req, res);
}