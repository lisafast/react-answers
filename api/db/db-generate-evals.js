import dbConnect from './db-connect.js';
import { Interaction } from '../../models/interaction.js';
import EvaluationService from '../../services/EvaluationService.js';
import config from '../../config/eval.js';
import { Setting } from '../../models/setting.js';


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { lastProcessedId, regenerateAll } = req.body;
        const duration = config.evalBatchProcessingDuration; // Use config value for duration

        // Get deploymentMode from settings
        let deploymentMode = 'CDS';
        try {
            await dbConnect();
            const setting = await Setting.findOne({ key: 'deploymentMode' });
            if (setting && setting.value) deploymentMode = setting.value;
        } catch (e) {
            console.error('Failed to read deploymentMode setting', e);
        }
        const result = await EvaluationService.processEvaluationsForDuration(duration, !regenerateAll, lastProcessedId, deploymentMode);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in generate-evals:', error);
        res.status(500).json({ error: 'Failed to generate evaluations' });
    }
}