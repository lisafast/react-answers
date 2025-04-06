// Removed express import
import fs from 'fs/promises';
import path from 'path';
import { authMiddleware, adminMiddleware, withProtection } from '../../middleware/auth.js'; // Import withProtection
import PromptDiscoveryService from '../../services/PromptDiscoveryService.js';
import DataStoreService from '../../services/DataStoreService.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';

// No router needed

// Define the core handler logic function
const getPromptHandlerLogic = async (req, res) => {
  // Check HTTP Method
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const adminUserId = req.user?._id;
  // Get filename from query parameters for Vercel compatibility
  // Note: server.js uses path params (:filename), Vercel uses query params
  // We need to handle both potentially, or standardize. Let's assume query for Vercel.
  // If using server.js, req.params.filename will be set. If using Vercel, req.query.filename.
  const filename = req.params.filename || req.query.filename;

  if (!adminUserId) {
    ServerLoggingService.warn('Admin user ID not found in request for GET /api/prompts/:filename', null, { filename, headers: req.headers });
    return res.status(401).json({ message: 'Unauthorized: Admin user ID missing.' });
  }

  if (!filename || typeof filename !== 'string' || !filename.endsWith('.js')) {
     ServerLoggingService.warn('Invalid filename parameter received', null, { filename, adminUserId });
     return res.status(400).json({ message: 'Invalid or missing filename parameter.' });
  }

  try {
    // 1. Check for active override in DB for this user and filename
    const override = await DataStoreService.getPromptOverride(adminUserId, filename);

    if (override) {
      // Active override found, return its content
      ServerLoggingService.debug('Returning active prompt override content', null, { adminUserId, filename });
      // Send as plain text, assuming prompt content is text-based
      res.set('Content-Type', 'text/plain');
      return res.send(override.content);
    }

    // 2. No active override found, get default content from filesystem
    ServerLoggingService.debug('No active override found, fetching default prompt content', null, { adminUserId, filename });
    const fullPath = await PromptDiscoveryService.getFullPath(filename);

    if (!fullPath) {
      ServerLoggingService.warn('Default prompt file not found via discovery service', null, { adminUserId, filename });
      return res.status(404).json({ message: `Prompt file '${filename}' not found.` });
    }

    // Read the default file content
    // IMPORTANT: Assuming the .js files export a string constant.
    // This simple readFile approach might need adjustment if the files have complex exports.
    // A more robust approach might involve dynamic import, but that adds complexity.
    // For now, reading raw content. Consider security implications if files aren't just simple strings.
    try {
      const defaultContent = await fs.readFile(fullPath, 'utf-8');
      res.set('Content-Type', 'text/plain');
      return res.send(defaultContent);
    } catch (readError) {
       ServerLoggingService.error('Error reading default prompt file', null, { adminUserId, filename, fullPath, error: readError.message });
       return res.status(500).json({ message: `Error reading default prompt file '${filename}'.` });
    }

  } catch (error) {
    ServerLoggingService.error('Error fetching prompt content in GET /api/prompts/:filename', null, { adminUserId, filename, error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error fetching prompt content.' });
  }
};

// Export a default function that wraps the core logic with protection
export default function handler(req, res) {
  // Apply middleware using withProtection to the handler logic
  // Requires authMiddleware and adminMiddleware
  return withProtection(getPromptHandlerLogic, authMiddleware, adminMiddleware)(req, res);
}
