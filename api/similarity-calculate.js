/**
 * API endpoint for similarity calculation
 */
import fetch from 'node-fetch';

/**
 * Calculate similarity between two text strings
 * @param {object} req - Request object 
 * @param {object} res - Response object
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { text1, text2, model = 'all-MiniLM-L6-v2' } = req.body;

    if (!text1 || !text2) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: text1 and text2 are required'
      });
    }
    
    try {
      // We'd normally call a service like Hugging Face API or OpenAI embeddings API
      // For now, we'll implement a simplified version that can be replaced later
      // with a real embeddings-based similarity service
      
      // Example of what a real implementation might look like:
      // const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     input: [text1, text2],
      //     model: 'text-embedding-3-large'
      //   }),
      // });
      // const embeddingData = await embeddingResponse.json();
      
      // Simple fallback using word overlap as a temporary solution
      const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(word => word.length > 3));
      const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(word => word.length > 3));
      
      const intersection = new Set([...words1].filter(word => words2.has(word)));
      const union = new Set([...words1, ...words2]);
      
      const similarity = intersection.size / Math.max(1, union.size);
      
      return res.status(200).json({
        success: true,
        similarity: similarity,
        model: 'fallback-word-overlap'
      });
    } catch (error) {
      console.error('Error calculating similarity:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  } catch (error) {
    console.error('Error in similarity API:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}