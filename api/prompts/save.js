// Removed express import
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js'; // Import withProtection
import DataStoreService from '../../services/DataStoreService.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';
import PromptDiscoveryService from '../../services/PromptDiscoveryService.js'; // Needed to validate filename

// No router needed

// Define the core handler logic function
const savePromptHandlerLogic = async (req, res) => {
  // Check HTTP Method
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const adminUserId = req.user?._id;
  // Get filename and content from body (now sent in body, not params/query)
  const { filename, content } = req.body;

  if (!adminUserId) {
    ServerLoggingService.warn('Admin user ID not found in request for PUT /api/prompts/:filename', null, { filename, headers: req.headers });
    return res.status(401).json({ message: 'Unauthorized: Admin user ID missing.' });
  }

  if (!filename || typeof filename !== 'string' || !filename.endsWith('.js')) {
     ServerLoggingService.warn('Invalid filename parameter received for save', null, { filename, adminUserId });
     return res.status(400).json({ message: 'Invalid or missing filename parameter.' });
  }

  if (typeof content !== 'string') {
    // Allow empty string, but not other types or missing
    ServerLoggingService.warn('Invalid or missing content in request body for save', null, { filename, adminUserId, body: req.body });
    return res.status(400).json({ message: 'Invalid or missing content in request body.' });
  }

  try {
    // Optional: Validate that the filename corresponds to an actual discoverable prompt file
    const fullPath = await PromptDiscoveryService.getFullPath(filename);
    if (!fullPath) {
      ServerLoggingService.warn('Attempted to save override for non-discoverable prompt file', null, { adminUserId, filename });
      // Decide whether to allow saving overrides for non-existent files or return an error.
      // Returning an error seems safer to prevent orphaned overrides.
      return res.status(404).json({ message: `Cannot save override: Prompt file '${filename}' does not exist.` });
    }

    // Save the override (creates or updates)
    const savedOverride = await DataStoreService.savePromptOverride(adminUserId, filename, content);

    res.status(200).json({ message: 'Prompt override saved successfully.', override: savedOverride });

  } catch (error) {
    // Handle potential unique constraint violation (duplicate user/filename) gracefully if needed
    if (error.code === 11000) { // MongoDB duplicate key error code
       ServerLoggingService.warn('Duplicate key error on saving prompt override (should be handled by upsert)', null, { adminUserId, filename, error: error.message });
       // This shouldn't happen with findOneAndUpdate upsert, but log just in case.
    }
    ServerLoggingService.error('Error saving prompt override in PUT /api/prompts/:filename', null, { adminUserId, filename, error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error saving prompt override.' });
  }
};

// Export a default function that wraps the core logic with protection
export default function handler(req, res) {
  // Apply middleware using withProtection to the handler logic
  // Requires authMiddleware and adminMiddleware
  return withProtection(savePromptHandlerLogic, authMiddleware, adminMiddleware)(req, res);
}
