import fs from 'fs/promises';
import path from 'path';
import ServerLoggingService from './ServerLoggingService.js';

const PROMPTS_BASE_DIR = path.resolve(process.cwd(), 'prompts'); // Assumes CWD is project root

class PromptDiscoveryService {
  constructor() {
    this.promptFileMap = null; // Cache the map
    this.lastScanTime = 0;
    this.cacheDuration = 5 * 60 * 1000; // Cache for 5 minutes to avoid frequent scans
  }

  /**
   * Recursively scans a directory for .js files.
   * @param {string} dirPath - The directory path to scan.
   * @param {Map<string, string>} fileMap - The map to populate (filename -> fullPath).
   * @private
   */
  async _scanDirectory(dirPath, fileMap) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await this._scanDirectory(fullPath, fileMap);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          // Use filename as key, full path as value
          if (fileMap.has(entry.name)) {
            // Handle potential duplicate filenames in different subdirs if necessary
            // For now, log a warning. Consider a different key strategy if duplicates are expected.
            ServerLoggingService.warn(`Duplicate prompt filename found: ${entry.name}. Overwriting path in map.`, null, { existingPath: fileMap.get(entry.name), newPath: fullPath });
          }
          fileMap.set(entry.name, fullPath);
        }
      }
    } catch (error) {
      ServerLoggingService.error(`Error scanning directory: ${dirPath}`, null, { error: error.message });
      // Decide if we should throw or just log
      throw error; // Rethrow for now, caller should handle
    }
  }

  /**
   * Gets the map of prompt filenames to their full paths.
   * Scans the filesystem if the cache is empty or expired.
   * @returns {Promise<Map<string, string>>} A map where keys are filenames (e.g., "roleAndGoal.js") and values are full paths.
   */
  async getPromptFileMap() {
    const now = Date.now();
    if (this.promptFileMap && (now - this.lastScanTime < this.cacheDuration)) {
      ServerLoggingService.debug('Returning cached prompt file map.');
      return this.promptFileMap;
    }

    ServerLoggingService.info('Scanning prompt directories...');
    const fileMap = new Map();
    try {
      await this._scanDirectory(PROMPTS_BASE_DIR, fileMap);
      this.promptFileMap = fileMap;
      this.lastScanTime = now;
      ServerLoggingService.info(`Prompt directory scan complete. Found ${fileMap.size} prompt files.`);
      return this.promptFileMap;
    } catch (error) {
      ServerLoggingService.error('Failed to build prompt file map.', null, { error: error.message });
      // Return an empty map or the potentially stale cache? For now, empty.
      this.promptFileMap = null; // Invalidate cache on error
      return new Map();
    }
  }

  /**
   * Gets the full path for a given prompt filename using the cached map.
   * Refreshes the map if needed.
   * @param {string} filename - The filename (e.g., "roleAndGoal.js").
   * @returns {Promise<string|null>} The full path or null if not found.
   */
  async getFullPath(filename) {
    const map = await this.getPromptFileMap();
    return map.get(filename) || null;
  }

  /**
   * Gets a list of all discovered prompt filenames.
   * Refreshes the map if needed.
   * @returns {Promise<string[]>} An array of prompt filenames.
   */
  async getAllPromptFilenames() {
    const map = await this.getPromptFileMap();
    return Array.from(map.keys());
  }
}

// Export a singleton instance
export default new PromptDiscoveryService();
