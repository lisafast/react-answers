// api/models/models-config.js
import AI_MODELS from '../../config/ai-models.js';

export const getModelsConfig = async (req, res) => {
    try {
        res.json(AI_MODELS);
    } catch (error) {
        console.error('Error fetching models config:', error);
        res.status(500).json({ error: 'Failed to fetch models configuration' });
    }
};