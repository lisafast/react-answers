/**
 * SimilarityService.js
 * Service for calculating similarity between texts and finding similar questions/answers
 * using sentence embeddings.
 */

import { DataStoreService } from '../src/services/DataStoreService.js';

/**
 * Service for calculating text similarity and finding similar content
 */
class SimilarityService {
  /**
   * Calculate cosine similarity between two text embeddings
   * @param {string} text1 - First text to compare
   * @param {string} text2 - Second text to compare
   * @returns {Promise<number>} Similarity score between 0 and 1
   */
  static async calculateCosineSimilarity(text1, text2) {
    try {
      // This would make a call to a backend service that handles ML operations
      const response = await fetch('/api/similarity/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text1, text2 }),
      });

      if (!response.ok) {
        throw new Error(`Error calculating similarity: ${response.statusText}`);
      }

      const result = await response.json();
      return result.similarity;
    } catch (error) {
      console.error('Error in calculateCosineSimilarity:', error);
      // Fall back to a basic similarity in case of error
      return SimilarityService.calculateBasicSimilarity(text1, text2);
    }
  }

  /**
   * Basic fallback similarity calculation based on word overlap
   * @param {string} text1 - First text to compare
   * @param {string} text2 - Second text to compare
   * @returns {number} Simple similarity score between 0 and 1
   */
  static calculateBasicSimilarity(text1, text2) {
    // Simple fallback using word overlap (for testing/fallback purposes)
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(word => word.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(word => word.length > 3));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Find similar questions in the database with high expert ratings
   * @param {string} question - The question to compare against
   * @param {number} threshold - Minimum similarity score (0-1) to include in results
   * @returns {Promise<Array>} Array of similar questions with their answers and ratings
   */
  static async findSimilarQuestions(question, threshold = 0.85) {
    try {
      // Get questions with high expert ratings
      const ratedQuestions = await DataStoreService.getGoldenAnswers();
      
      // For now we'll calculate similarity on client side
      // In production, this would be handled by a dedicated similarity service
      const results = [];
      
      for (const item of ratedQuestions) {
        const similarity = await this.calculateCosineSimilarity(
          question, 
          item.question
        );
        
        if (similarity >= threshold) {
          results.push({
            ...item,
            similarityScore: similarity
          });
        }
      }
      
      // Sort by similarity (highest first)
      return results.sort((a, b) => b.similarityScore - a.similarityScore);
    } catch (error) {
      console.error('Error finding similar questions:', error);
      return [];
    }
  }
}

export default SimilarityService;