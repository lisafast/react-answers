  // src/ContextService.js

import loadContextSystemPrompt from './contextSystemPrompt.js';

const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api/claude-haiku'  // Vercel serverless function for Haiku
  : 'http://localhost:3001/api/haiku';  // Local development server endpoint for Haiku

const ContextService = {
  sendMessage: async (message, lang = 'en', department = '') => {
    try {
      console.log(`🤖 Haiku Service: Processing message in ${lang.toUpperCase()}`);
      
      const SYSTEM_PROMPT = await loadContextSystemPrompt(lang, department);
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          systemPrompt: SYSTEM_PROMPT,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Claude Haiku API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      return data.content;
    } catch (error) {
      console.error('Error calling Claude Haiku API:', error);
      throw error;
    }
  },
  
  deriveContext: async (question, lang = 'en', department = '') => {
    try {
      console.log(`🤖 Context Service: Analyzing question in ${lang.toUpperCase()}`);
      
      const response = await ContextService.sendMessage(question, lang, department);
      
      // Parse the XML-style tags from the response
      const topicMatch = response.match(/<topic>(.*?)<\/topic>/);
      const topicUrlMatch = response.match(/<topicUrl>(.*?)<\/topicUrl>/);
      const departmentMatch = response.match(/<department>(.*?)<\/department>/);
      const departmentUrlMatch = response.match(/<departmentUrl>(.*?)<\/departmentUrl>/);
      
      return {
        topic: topicMatch ? topicMatch[1] : 'none',
        topicUrl: topicUrlMatch ? topicUrlMatch[1] : '',
        department: departmentMatch ? departmentMatch[1] : '',
        departmentUrl: departmentUrlMatch ? departmentUrlMatch[1] : ''
      };
    } catch (error) {
      console.error('Error deriving context:', error);
      throw error;
    }
  }
};

export default ContextService;