import DataStoreService from '../services/DataStoreService.js';

// GET /api/settings
export async function getSettingsHandler(req, res) {
  try {
    const settings = await DataStoreService.getSettings();
    res.status(200).json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings', details: err.message });
  }
}

// POST /api/settings
export async function updateSettingsHandler(req, res) {
  try {
    const { batchDuration, embeddingDuration, evalDuration, rateLimiterType, rateLimitPoints, rateLimitDuration } = req.body;
    // Validation: required, positive integers, > 0
    for (const [key, value] of Object.entries({ batchDuration, embeddingDuration, evalDuration })) {
      if (value === undefined || value === null) {
        return res.status(400).json({ error: `${key} is required.` });
      }
      if (!Number.isInteger(value) || value <= 0) {
        return res.status(400).json({ error: `${key} must be a positive integer.` });
      }
    }
    // Validate rate limiter type
    if (!['memory', 'mongodb'].includes(rateLimiterType)) {
      return res.status(400).json({ error: 'rateLimiterType must be either "memory" or "mongodb".' });
    }
    // Validate rate limit points and duration
    for (const [key, value] of Object.entries({ rateLimitPoints, rateLimitDuration })) {
      if (value === undefined || value === null) {
        return res.status(400).json({ error: `${key} is required.` });
      }
      if (!Number.isInteger(value) || value <= 0) {
        return res.status(400).json({ error: `${key} must be a positive integer.` });
      }
    }
    const updated = await DataStoreService.updateSettings({
      batchDuration,
      embeddingDuration,
      evalDuration,
      rateLimiterType,
      rateLimitPoints,
      rateLimitDuration
    });
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings', details: err.message });
  }
}
