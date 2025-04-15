// Removed express import
import fs from 'fs/promises'; // Import fs for reading default content
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js'; // Import withProtection
import DataStoreService from '../../services/DataStoreService.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';
import PromptOverride from '../../models/promptOverride.js'; // Import model for findOne
import PromptDiscoveryService from '../../services/PromptDiscoveryService.js'; // Import discovery service

// No router needed

// Define the core handler logic function
const updateStatusHandlerLogic = async (req, res) => {
  // Check HTTP Method
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const adminUserId = req.user?._id;
  // Get filename from body (now sent in body, not params/query)
  const { filename, isActive } = req.body;
  // Removed debugging logs


  if (!adminUserId) {
    ServerLoggingService.warn('Admin user ID not found in request for PATCH /api/prompts/:filename/status', null, { filename, headers: req.headers });
    return res.status(401).json({ message: 'Unauthorized: Admin user ID missing.' });
  }

  if (!filename || typeof filename !== 'string' || !filename.endsWith('.js')) {
     ServerLoggingService.warn('Invalid filename parameter received for status update', null, { filename, adminUserId });
     return res.status(400).json({ message: 'Invalid or missing filename parameter.' });
  }

  if (typeof isActive !== 'boolean') {
    ServerLoggingService.warn('Invalid or missing isActive flag in request body for status update', null, { filename, adminUserId, body: req.body });
    return res.status(400).json({ message: 'Invalid or missing isActive flag (boolean) in request body.' });
  }

  try {
    if (isActive) {
      // --- Activating ---
      // 1. Check if an override already exists for this user/file
      const existingOverride = await PromptOverride.findOne({ userId: adminUserId, filename });

      if (existingOverride) {
        // 2a. Override exists, just update its status if it's not already active
        if (!existingOverride.isActive) {
          const updateResult = await DataStoreService.setPromptOverrideActiveState(adminUserId, filename, true);
          if (updateResult.modifiedCount > 0) {
             ServerLoggingService.info('Existing prompt override activated successfully', null, { adminUserId, filename });
             res.status(200).json({ message: `Prompt override '${filename}' activated successfully.` });
          } else {
             // Should not happen if isActive was false, but handle defensively
             ServerLoggingService.error('Failed to activate existing prompt override', null, { adminUserId, filename, updateResult });
             res.status(500).json({ message: 'Failed to activate existing prompt override.' });
          }
        } else {
          // Already active, no change needed
          ServerLoggingService.info('Prompt override already active', null, { adminUserId, filename });
          res.status(200).json({ message: `Prompt override '${filename}' was already active.` });
        }
      } else {
        // 2b. Override does not exist, create it with default content
        ServerLoggingService.info('No existing override found, creating new one with default content', null, { adminUserId, filename });
        // Fetch default content
        let defaultContent = '';
        try {
           const fullPath = await PromptDiscoveryService.getFullPath(filename);
           if (!fullPath) {
             ServerLoggingService.error('Cannot create override: Default prompt file not found', null, { adminUserId, filename });
             return res.status(404).json({ message: `Cannot create override: Default prompt file '${filename}' not found.` });
           }
           defaultContent = await fs.readFile(fullPath, 'utf-8');
        } catch (readError) {
           ServerLoggingService.error('Error reading default prompt file for override creation', null, { adminUserId, filename, error: readError.message });
           return res.status(500).json({ message: `Error reading default prompt file '${filename}'.` });
        }

        // Save the new override (savePromptOverride sets isActive: true on creation)
        const savedOverride = await DataStoreService.savePromptOverride(adminUserId, filename, defaultContent);
        ServerLoggingService.info('New prompt override created and activated successfully', null, { adminUserId, filename, overrideId: savedOverride._id });
        res.status(201).json({ message: `Prompt override '${filename}' created and activated successfully.` }); // 201 Created
      }
    } else {
      // --- Deactivating ---
      // Just update the state, don't care if it existed before or not
      const result = await DataStoreService.setPromptOverrideActiveState(adminUserId, filename, false);
      if (result.modifiedCount > 0) {
        ServerLoggingService.info('Prompt override deactivated successfully', null, { adminUserId, filename });
        res.status(200).json({ message: `Prompt override '${filename}' deactivated successfully.` });
      } else {
        // matchedCount === 0 OR (matchedCount > 0 && modifiedCount === 0) -> Already inactive or non-existent
        ServerLoggingService.info('Prompt override already inactive or non-existent', null, { adminUserId, filename });
        res.status(200).json({ message: `Prompt override '${filename}' was already inactive or did not exist.` });
      }
    }
  } catch (error) { // Catch errors from findOne, readFile, save, or update
    ServerLoggingService.error('Error updating prompt override status in PATCH /api/prompts/:filename/status', null, { adminUserId, filename, isActive, error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error updating prompt override status.' });
  }
};

// Export a default function that wraps the core logic with protection
export default function handler(req, res) {
  // Apply middleware using withProtection to the handler logic
  // Requires authMiddleware and adminMiddleware
  // Body parsing is handled globally in server.js or by Vercel
  return withProtection(updateStatusHandlerLogic, authMiddleware, adminMiddleware)(req, res);
}
