import EvaluationService from '../services/EvaluationService.js';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';

const upload = multer({ dest: os.tmpdir() });

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Use multer middleware
  upload.fields([
    { name: 'goldenFile', maxCount: 1 },
    { name: 'brownFile', maxCount: 1 }
  ])(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: 'Error uploading files' });
    }

    try {
      const { goldenFile, brownFile } = req.files;
      const duration = req.body.duration;

      await EvaluationService.initialize();

      const goldenFilePath = null; //goldenFile[0].path;
      const brownFilePath = null; //brownFile[0].path;

      // Start the evaluation process with file paths
      const evaluationId = await EvaluationService.startEvaluation(
        goldenFilePath,
        brownFilePath,
        duration
      );

      // Clean up temporary files
      fs.unlinkSync(goldenFilePath);
      fs.unlinkSync(brownFilePath);

      res.status(200).json({
        message: 'Evaluation started successfully',
        evaluationId
      });
    } catch (error) {
      console.error('Error processing evaluation:', error);
      res.status(500).json({ error: 'Error starting evaluation' });
    }
  });
}