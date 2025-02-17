import xlsx from 'xlsx';
import fs from 'fs';
import { createReadStream } from 'fs';
import { createResearchAgent, createEvaluatorAgent } from '../agents/AgentService.js';

const EvaluationService = {
  researchAgent: null,
  evaluatorAgent: null,

  initialize: async () => {
    if (!EvaluationService.researchAgent || !EvaluationService.evaluatorAgent) {
      EvaluationService.researchAgent = await createResearchAgent();
      EvaluationService.evaluatorAgent = await createEvaluatorAgent();
    }
  },

  startEvaluation: async (goldenFilePath, brownFilePath, duration) => {
    try {
      const response = await fetch(`/api/chat-logs?days=${duration}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch chat logs');
      }

      const questionsToEvaluate = data.logs.filter(chat => !chat.expertRating);

      if (questionsToEvaluate.length === 0) {
        console.log('No questions to evaluate');
        return true;
      }

      for (const question of questionsToEvaluate) {
        const researchResult = await EvaluationService.researchAgent.invoke({
          messages: [
            {
              role: "user",
              content: question.question
            }
          ]
        });

        const researchAnswer = researchResult.messages[researchResult.messages.length - 1].content;

        const evaluationResult = await EvaluationService.evaluatorAgent.invoke({
          messages: [
            {
              role: "system",
              content: `You are an evaluation agent. Compare the following answers and rate their accuracy:
              Original Answer: ${question.answer}
              Research Agent Answer: ${researchAnswer}
              Citation URL: ${question.citationUrl}
              
              Rate each answer's accuracy on these criteria:
              1. Factual correctness (0-100)
              2. Citation relevance (0-100)
              3. Completeness (0-100)
              
              Provide your evaluation in this format:
              <evaluation>
              <factual-score>X</factual-score>
              <citation-score>X</citation-score>
              <completeness-score>X</completeness-score>
              <feedback>Your detailed feedback here</feedback>
              </evaluation>`
            }
          ]
        });

        await EvaluationService.storeEvaluationResults({
          question: question.question,
          originalAnswer: question.answer,
          researchAnswer,
          evaluationResult: evaluationResult.messages[evaluationResult.messages.length - 1].content,
          isGolden: false
        });
      }

      return true;
    } catch (error) {
      console.error('Error in evaluation process:', error);
      throw error;
    }
  },

  parseXLSXFile: async (filePath) => {
    return new Promise((resolve, reject) => {
      try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const results = xlsx.utils.sheet_to_json(worksheet);
        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  },

  storeEvaluationResults: async (results) => {
    // TODO: Implement storing results in database
    console.log('Evaluation results:', results);
  }
};

export default EvaluationService;