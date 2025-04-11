import dbConnect from './db-connect.js';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js';
import mongoose from 'mongoose';

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
      // Export database
      const backup = {};
      
      for (const [name, model] of Object.entries(collections)) {
        backup[name] = await model.find({}).lean();
      }

      res.setHeader('Content-Disposition', `attachment; filename=database-backup-${new Date().toISOString()}.json`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(backup);

    } else if (req.method === 'POST') {
      // Import database
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