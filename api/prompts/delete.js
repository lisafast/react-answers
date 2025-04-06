// Removed express import
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js'; // Import withProtection
import DataStoreService from '../../services/DataStoreService.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';

// No router needed

// Define the core handler logic function
const deleteOverrideHandlerLogic = async (req, res) => {
  // Check HTTP Method
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const adminUserId = req.user?._id;
  // Get filename from params (Express) or query (Vercel)
  const filename = req.params.filename || req.query.filename;

  if (!adminUserId) {
    ServerLoggingService.warn('Admin user ID not found in request for DELETE /api/prompts/:filename', null, { filename, headers: req.headers });
    return res.status(401).json({ message: 'Unauthorized: Admin user ID missing.' });
  }

  if (!filename || typeof filename !== 'string' || !filename.endsWith('.js')) {
     ServerLoggingService.warn('Invalid filename parameter received for delete', null, { filename, adminUserId });
     return res.status(400).json({ message: 'Invalid or missing filename parameter.' });
  }

  try {
    const result = await DataStoreService.deletePromptOverride(adminUserId, filename);

    if (result.deletedCount === 0) {
      // This implies the override didn't exist for this user/filename combination
      ServerLoggingService.warn('Attempted to delete non-existent prompt override', null, { adminUserId, filename });
      return res.status(404).json({ message: `Prompt override for '${filename}' not found for this user.` });
    }

    res.status(200).json({ message: `Prompt override '${filename}' deleted successfully.` });

  } catch (error) {
    ServerLoggingService.error('Error deleting prompt override in DELETE /api/prompts/:filename', null, { adminUserId, filename, error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error deleting prompt override.' });
  }
};

// Export a default function that wraps the core logic with protection
export default function handler(req, res) {
  // Apply middleware using withProtection to the handler logic
  // Requires authMiddleware and adminMiddleware
  return withProtection(deleteOverrideHandlerLogic, authMiddleware, adminMiddleware)(req, res);
}
