import dbConnect from './db-connect.js';
import { Interaction } from '../../models/interaction.js';
import EvaluationService from '../../services/EvaluationService.js';
import SettingsService from '../../services/SettingsService.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { lastProcessedId, regenerateAll } = req.body;
        const duration = await SettingsService.getEvalDuration();
        const result = await EvaluationService.processEvaluationsForDuration(duration, !regenerateAll, lastProcessedId);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in generate-evals:', error);
        res.status(500).json({ error: 'Failed to generate evaluations' });
    }
}