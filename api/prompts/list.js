// Removed express import
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js'; // Import withProtection
import PromptDiscoveryService from '../../services/PromptDiscoveryService.js';
import DataStoreService from '../../services/DataStoreService.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';


// Define the core handler logic function (not exported directly)
const listPromptsHandlerLogic = async (req, res) => {
  // Check HTTP Method
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const adminUserId = req.user?._id; // Assumes middleware attaches user object with _id

  if (!adminUserId) {
    // Should ideally be caught by middleware, but double-check
    ServerLoggingService.warn('Admin user ID not found in request for GET /api/prompts', null, { headers: req.headers });
    return res.status(401).json({ message: 'Unauthorized: Admin user ID missing.' });
  }

  try {
    // Get all prompt filenames and their full paths
    const promptFileMap = await PromptDiscoveryService.getPromptFileMap();
    if (!promptFileMap || promptFileMap.size === 0) {
      ServerLoggingService.warn('No prompt files discovered by PromptDiscoveryService for GET /api/prompts', null, { adminUserId });
      return res.json([]); // Return empty list if no prompts found
    }

    // Get all overrides for the current admin user
    const userOverrides = await DataStoreService.getAllUserOverrides(adminUserId);
    const overridesMap = new Map(userOverrides.map(o => [o.filename, { isActive: o.isActive }]));

    // Combine the information
    const promptList = Array.from(promptFileMap.entries()).map(([filename, fullPath]) => {
      const overrideInfo = overridesMap.get(filename);
      return {
        filename: filename,
        // fullPath: fullPath, // Maybe don't expose full server path to client? Optional.
        hasOverride: !!overrideInfo,
        isActive: overrideInfo ? overrideInfo.isActive : false, // Default to false if no override exists
      };
    });

    // Sort alphabetically by filename for consistent UI
    promptList.sort((a, b) => a.filename.localeCompare(b.filename));

    res.json(promptList);

  } catch (error) {
    
    ServerLoggingService.error('Error fetching prompt list in GET /api/prompts', null, { adminUserId, error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error fetching prompt list.' });
  }
};

// Export a default function that wraps the core logic with protection
export default function handler(req, res) {
  // Apply middleware using withProtection to the handler logic
  // This requires authMiddleware and adminMiddleware for listing prompts
  return withProtection(listPromptsHandlerLogic, authMiddleware, adminMiddleware)(req, res);
}
