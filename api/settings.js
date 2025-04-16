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
    const { batchDuration, embeddingDuration, evalDuration } = req.body;
    // Validation: required, positive integers, > 0
    for (const [key, value] of Object.entries({ batchDuration, embeddingDuration, evalDuration })) {
      if (value === undefined || value === null) {
        return res.status(400).json({ error: `${key} is required.` });
      }
      if (!Number.isInteger(value) || value <= 0) {
        return res.status(400).json({ error: `${key} must be a positive integer.` });
      }
    }
    const updated = await DataStoreService.updateSettings({ batchDuration, embeddingDuration, evalDuration });
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings', details: err.message });
  }
}
