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
      // Chunked export support
      const { collection, skip = 0, limit = 1000 } = req.query;
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
      // Paginated export for a single collection
      const docs = await model.find({}).skip(Number(skip)).limit(Number(limit)).lean();
      const total = await model.countDocuments();
      return res.status(200).json({
        collection,
        total,
        skip: Number(skip),
        limit: Number(limit),
        data: docs
      });
    } else if (req.method === 'POST') {
      // Chunked upload support
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
      // Import database (non-chunked)
      if (!req.files || !req.files.backup) {
        return res.status(400).json({ message: 'No backup file provided' });
      }

      let backup;
      try {
        backup = JSON.parse(req.files.backup.data.toString());
      } catch (error) {
        return res.status(400).json({ message: 'Invalid backup file format' });
      }

      try {
        // Clear existing data
        await Promise.all(Object.values(collections).map(model => 
          model.deleteMany({})
        ));
        
        // Drop all indexes for each collection
        await Promise.all(Object.values(collections).map(async model => {
          try {
            await model.collection.dropIndexes();
            console.log(`Dropped indexes for ${model.modelName}`);
          } catch (error) {
            console.warn(`Error dropping indexes for ${model.modelName}:`, error.message);
          }
        }));

        // Multi-pass import to handle dependencies between collections
        const pendingCollections = { ...backup };
        const stats = {
          totalCollections: Object.keys(pendingCollections).length,
          insertedCollections: 0,
          maxPasses: 5, // Prevent infinite loops
          currentPass: 0
        };
        
        let madeProgress = true;
        
        // Continue as long as we're making progress and haven't reached the max passes
        while (madeProgress && stats.currentPass < stats.maxPasses && Object.keys(pendingCollections).length > 0) {
          stats.currentPass++;
          madeProgress = false;
          
          // Track collections that were successfully processed in this pass
          const successfulCollections = [];
          
          for (const [name, data] of Object.entries(pendingCollections)) {
            const model = collections[name.toLowerCase()];
            
            // Skip if no model found or no data to insert
            if (!model || !Array.isArray(data) || data.length === 0) {
              successfulCollections.push(name);
              continue;
            }
            
            try {
              // Try to insert the data for this collection
              await model.insertMany(data);
              successfulCollections.push(name);
              stats.insertedCollections++;
              madeProgress = true;
            } catch (error) {
              // If insertion fails, this collection might depend on others
              // We'll retry it in the next pass
              console.log(`Pass ${stats.currentPass}: Failed to insert ${name}. Will retry in next pass.`);
            }
          }
          
          // Remove successfully processed collections from pending
          for (const name of successfulCollections) {
            delete pendingCollections[name];
          }
        }
        
        // Check if any collections couldn't be imported
        if (Object.keys(pendingCollections).length > 0) {
          console.warn(`Import incomplete. Could not import: ${Object.keys(pendingCollections).join(', ')}`);
        }
        
        return res.status(200).json({ 
          message: 'Database restored successfully', 
          stats: {
            totalCollections: stats.totalCollections,
            insertedCollections: stats.insertedCollections,
            passes: stats.currentPass,
            failedCollections: Object.keys(pendingCollections)
          } 
        });
      } catch (error) {
        throw error;
      }
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