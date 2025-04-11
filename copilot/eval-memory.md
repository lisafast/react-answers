Are the golden/brown answers curated in some way? Or are they just a pull from chat logs that have 0 or 100? If so, why not just pull those directly from database instead of from air table?

So the process is as follows:

Get the chat logs, and filter out anything that already has a expert feedback score.
Go through each of those and use an agent to evaluate the answer based on what it knows.
Score each sentence, and if a score is not 100 then explain why
I'd suggest a reasoning model to do the evaluation.

Is there a way we could use the expertFeedback table for evaluations?
We could add "type" either "human" or "ai"
The only difference is that the Expert feedback only contains one textbox for the whole reponse instead of per sentence. If we updated the experfeedback to open a textarea for each answer under 100, then we could reuse the table

@ryanhyma I believe there were a LOT of scored answers before the database change but I could be wrong - @anniecrombie has the sense of that. In addition there are a LOT of scored answers in the database and airtable that didn't score 100 but didn't have an error - so they have a 'needs improvement' score in there. That said, I agree that just using the database would be better than curated sets. I just wasn't sure there was enough in there. @anniecrombie would have a better sense.

Re the expertFeedback table, yes I definitely hoped to use it - i see your point about a sentence for each sentence under 100 - that's a good idea. That way if there happen to be 2 sentences that are incorrect, the textbox matches the sentence.

And yes, type = human or ai - eventually we might also want 'public-servant', 'end-user' and 'gpt-40' - let's put the model name there instead of AI.

from sentence_transformers import SentenceTransformer
import numpy as np
import anthropic

faq_variations = [
    {"questions": ["What's your return policy?", "How can I return an item?", "Wut's yur retrn polcy?"], "answer": "Our return policy allows..."},  # Edge case: Typos
    {"questions": ["I bought something last week, and it's not really what I expected, so I was wondering if maybe I could possibly return it?", "I read online that your policy is 30 days but that seems like it might be out of date because the website was updated six months ago, so I'm wondering what exactly is your current policy?"], "answer": "Our return policy allows..."},  # Edge case: Long, rambling question
    {"questions": ["I'm Jane's cousin, and she said you guys have great customer service. Can I return this?", "Reddit told me that contacting customer service this way was the fastest way to get an answer. I hope they're right! What is the return window for a jacket?"], "answer": "Our return policy allows..."},  # Edge case: Irrelevant info
    # ... 47 more FAQs
]

client = anthropic.Anthropic()

def get_completion(prompt: str):
    message = client.messages.create(
        model="claude-3-7-sonnet-20250219",
        max_tokens=2048,
        messages=[
        {"role": "user", "content": prompt}
        ]
    )
    return message.content[0].text

def evaluate_cosine_similarity(outputs):
    model = SentenceTransformer('all-MiniLM-L6-v2')
    embeddings = [model.encode(output) for output in outputs]

    cosine_similarities = np.dot(embeddings, embeddings.T) / (np.linalg.norm(embeddings, axis=1) * np.linalg.norm(embeddings, axis=1).T)
    return np.mean(cosine_similarities)

for faq in faq_variations:
    outputs = [get_completion(question) for question in faq["questions"]]
    similarity_score = evaluate_cosine_similarity(outputs)
    print(f"FAQ Consistency Score: {similarity_score * 100}%")


    So they do:
text-embedding-3-largeMost capable embedding model for both english and non-english tasks | 3,072
text-embedding-3-smallIncreased performance over 2nd generation ada embedding model | 1,536
text-embedding-ada-002Most capable 2nd generation embedding model, replacing 16 first generation models | 1,536

What I'm not sure about is if these models will be available with our API key. We'll have to ask, I don't remember them being listed when we talked to Calvin.

@lisafast

// Append this to the end of the file

## Evaluation Service Implementation Plan (February 26, 2025)

### Overview
Implementation plan for the EvaluationService that will perform automated evaluation of answers. The process will:
1. Trigger evaluation when feedback is submitted without an evaluation
2. Find similar questions with highly-rated answers using cosine similarity
3. Compare new answers with golden answers (rated 100)
4. Perform AI-based evaluation when no similar golden answers exist

### Service Structure

#### 1. EvaluationService.js
```javascript
import { DataStoreService } from './DataStoreService';
import { SimilarityService } from './SimilarityService';

export class EvaluationService {
  static async evaluateAnswer(question, answer) {
    try {
      // Step 1: Find similar questions with highly-rated answers
      const similarQuestions = await SimilarityService.findSimilarQuestions(question);
      
      // Step 2: If we have similar golden answers, use them for comparison
      if (similarQuestions.length > 0) {
        const evaluation = await this.compareWithGoldenAnswers(answer, similarQuestions);
        await DataStoreService.storeEvaluation(questionId, evaluation);
        return {
          success: true,
          evaluation
        };
      }
      
      // Step 3: If no similar questions, perform pure AI evaluation
      const aiEvaluation = await this.performAIEvaluation(question, answer);
      await DataStoreService.storeEvaluation(questionId, aiEvaluation);
      return {
        success: true,
        evaluation: aiEvaluation
      };
    } catch (error) {
      console.error('Error in evaluation process:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  static async compareWithGoldenAnswers(currentAnswer, similarQuestions) {
    // Break down answers into sentences
    const currentSentences = this.breakIntoSentences(currentAnswer);
    
    // For each similar question, compare the current answer with the golden answer
    const evaluations = [];
    
    for (const question of similarQuestions) {
      const goldenAnswer = question.answer;
      const goldenSentences = this.breakIntoSentences(goldenAnswer);
      
      // Compare sentences and generate scores
      const sentenceScores = [];
      
      for (const sentence of currentSentences) {
        // Find the most similar sentence in the golden answer
        let bestScore = 0;
        let feedback = '';
        
        for (const goldenSentence of goldenSentences) {
          const similarity = await SimilarityService.calculateCosineSimilarity(
            sentence, goldenSentence
          );
          
          if (similarity > bestScore) {
            bestScore = similarity;
            // If score is below 100, provide feedback
            if (bestScore < 1.0) {
              feedback = await this.generateFeedback(sentence, goldenSentence);
            }
          }
        }
        
        sentenceScores.push({
          sentence,
          score: Math.round(bestScore * 100),
          feedback
        });
      }
      
      evaluations.push({
        similarQuestion: question.question,
        sentenceScores
      });
    }
    
    return this.aggregateEvaluations(evaluations);
  }
  
  static async performAIEvaluation(question, answer) {
    // Use Claude-3.7-Sonnet to evaluate the answer
    const sentences = this.breakIntoSentences(answer);
    const sentenceScores = [];
    
    for (const sentence of sentences) {
      // Call AI to evaluate each sentence
      const evaluation = await this.callAIEvaluation(question, sentence);
      
      sentenceScores.push({
        sentence,
        score: evaluation.score,
        feedback: evaluation.feedback
      });
    }
    
    return {
      sentenceScores,
      overallScore: this.calculateOverallScore(sentenceScores)
    };
  }
  
  static breakIntoSentences(text) {
    // Simple sentence splitting logic
    return text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  }
  
  static calculateOverallScore(sentenceScores) {
    // Calculate weighted average based on sentence length
    const totalLength = sentenceScores.reduce((sum, item) => sum + item.sentence.length, 0);
    const weightedSum = sentenceScores.reduce((sum, item) => 
      sum + (item.score * (item.sentence.length / totalLength)), 0);
    
    return Math.round(weightedSum);
  }
}

export class SimilarityService {
  // Use sentence-transformers to calculate cosine similarity
  static async calculateCosineSimilarity(text1, text2) {
    // Implementation using a pre-trained model like all-MiniLM-L6-v2
    // This would be a call to a backend API that handles the ML operations
  }
  
  static async findSimilarQuestions(question, threshold = 0.85) {
    // Find questions in the database with high similarity scores
    const questions = await DataStoreService.getAllRatedQuestions();
    
    // Return questions with similarity above threshold
  }
}

// Add these methods to the existing DataStoreService

// Get all questions with perfect ratings (score 100)
static async getGoldenAnswers() {
  try {
    const result = await this.callApi('GET', 'api/feedback/golden');
    return result.data;
  } catch (error) {
    console.error('Error fetching golden answers:', error);
    return [];
  }
}

// Store AI evaluation results
static async storeEvaluation(questionId, evaluation) {
  try {
    const payload = {
      questionId,
      evaluation,
      type: 'claude-3-7-sonnet', // Using specific model name
      timestamp: new Date()
    };
    
    const result = await this.callApi('POST', 'api/feedback/evaluation', payload);
    return result.data;
  } catch (error) {
    console.error('Error storing evaluation:', error);
    throw error;
  }
}

Add timestamp and metadata fields for tracking

Integration with Expert Feedback UI
The Expert Feedback component should be updated to:

Show sentence-by-sentence evaluation
Allow feedback on individual sentences that score below 100
Trigger evaluation when human feedback is submitted
Next Steps
Implement backend API for embedding and similarity calculations using the sentence_transformers library
Create the AI evaluation API endpoint using Claude-3.7-Sonnet
Update the database schema
Update the UI to display sentence-level feedback
Implement a feedback loop to improve AI evaluations over time