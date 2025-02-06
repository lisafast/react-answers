// src/ContextService.js
import loadContextSystemPrompt from './contextSystemPrompt.js';
import { getProviderApiUrl, getApiUrl } from '../utils/apiToUrl.js';
import { departments_EN } from './systemPrompt/departments_EN.js';
import { departments_FR } from './systemPrompt/departments_FR.js';

const ContextService = {
  determineDepartmentFromResults: (searchResults, lang = 'en') => {
    if (!searchResults) return null;
    
    const departments = lang === 'fr' ? departments_FR : departments_EN;

    // Convert the string results into structured data
    const resultLines = searchResults.split('\n');
    const results = [];
    let currentResult = {};
    
    resultLines.forEach(line => {
      if (line.startsWith('Link: ')) {
        currentResult.link = line.replace('Link: ', '').trim();
      } else if (line.startsWith('Title: ') || line.startsWith('Link Text: ')) {
        currentResult.title = line.replace(/^(Title: |Link Text: )/, '').trim();
      } else if (line.startsWith('Summary: ')) {
        currentResult.summary = line.replace('Summary: ', '').trim();
        results.push({...currentResult});
        currentResult = {};
      }
    });

    // Try to determine department from URLs first by matching exact department URLs
    for (const result of results) {
      if (!result.link) continue;
      
      const url = result.link.toLowerCase();
      // First try exact URL matches from departments list
      const deptByUrl = departments.find(dept => 
        dept.url && url.startsWith(dept.url.toLowerCase())
      );
      
      if (deptByUrl) {
        return deptByUrl.name;
      }

      // Fallback to canada.ca path analysis
      if (url.includes('canada.ca/')) {
        const urlParts = url.split('/');
        const deptIndex = urlParts.indexOf('canada.ca') + 1;
        if (deptIndex < urlParts.length) {
          const urlPath = urlParts[deptIndex];
          // Try to match department by path segment
          const deptByPath = departments.find(dept => {
            if (!dept.url) return false;
            const deptUrlPath = dept.url.toLowerCase().split('/').find(part => 
              part !== 'canada.ca' && part !== 'en' && part !== 'fr' && part.length > 2
            );
            return deptUrlPath && urlPath === deptUrlPath;
          });
          
          if (deptByPath) {
            return deptByPath.name;
          }
        }
      }
    }

    // If no department found in URLs, try content analysis using department names and abbreviations
    for (const result of results) {
      const content = `${result.title} ${result.summary}`.toLowerCase();
      
      // Try matching by full department name or abbreviation
      const matchedDept = departments.find(dept => {
        const nameMatch = dept.name.toLowerCase().split(' ')
          .some(word => word.length > 3 && content.includes(word.toLowerCase()));
        const abbrMatch = dept.abbr && content.includes(dept.abbr.toLowerCase());
        return nameMatch || abbrMatch;
      });

      if (matchedDept) {
        return matchedDept.name;
      }
    }

    return null;
  },

  sendMessage: async (aiProvider, message, lang = 'en', department = '', referringUrl, searchResults, searchProvider) => {
    try {
      console.log(`🤖 Context Service: Processing message in ${lang.toUpperCase()}`);

      const SYSTEM_PROMPT = await loadContextSystemPrompt(lang, department);
      message += (referringUrl ? `\n<referring-url>${referringUrl}</referring-url>` : '');
      const response = await fetch(getProviderApiUrl(aiProvider, "context"), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          systemPrompt: SYSTEM_PROMPT,
          aiProvider: aiProvider,
          searchResults: searchResults,
          searchProvider: searchProvider,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Context API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();


    } catch (error) {
      console.error('Error calling Context API:', error);
      throw error;
    }
  },
  contextSearch: async (message, searchProvider) => {
    try {
      const searchResponse = await fetch(getApiUrl("search-context"), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: message,
          searchService: searchProvider  // Add searchProvider
        }),
      });

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error('Search API error response:', errorText);
        throw new Error(`HTTP error! status: ${searchResponse.status}`);
      }

      return await searchResponse.json();
    } catch (error) {
      console.error('Error searching context:', error);
      throw error;
    }

  },
  deriveContext: async (aiProvider, question, lang = 'en', department = '', referringUrl, searchProvider) => {
    try {
      console.log(`🤖 Context Service: Analyzing question in ${lang.toUpperCase()}`);
      const searchResults = await ContextService.contextSearch(question, searchProvider);
      console.log('Executed Search:', question + ' ' + searchProvider);
      
      // Try to determine department from search results if not provided, passing the language
      if (!department) {
        department = ContextService.determineDepartmentFromResults(searchResults.results, lang) || '';
      }

      const context = ContextService.parseContext(
        await ContextService.sendMessage(
          aiProvider, 
          question, 
          lang, 
          department, 
          referringUrl, 
          searchResults.results, 
          searchProvider
        )
      );
      context.searchDepartment = department;
      return context;
    } catch (error) {
      console.error('Error deriving context:', error);
      throw error;
    }
  },
  parseContext: (context) => {
    const topicMatch = context.message.match(/<topic>([\s\S]*?)<\/topic>/);
    const topicUrlMatch = context.message.match(/<topicUrl>([\s\S]*?)<\/topicUrl>/);
    const departmentMatch = context.message.match(/<department>([\s\S]*?)<\/department>/);
    const departmentUrlMatch = context.message.match(/<departmentUrl>([\s\S]*?)<\/departmentUrl>/);


    return {
      topic: topicMatch ? topicMatch[1] : null,
      topicUrl: topicUrlMatch ? topicUrlMatch[1] : null,
      department: departmentMatch ? departmentMatch[1] : null,
      departmentUrl: departmentUrlMatch ? departmentUrlMatch[1] : null,
      searchResults: context.searchResults,
      searchProvider: context.searchProvider,
      model: context.model,
      inputTokens: context.inputTokens,
      outputTokens: context.outputTokens,
    };
  },

  deriveContextBatch: async (entries, lang = 'en', aiService = 'anthropic', batchName, searchProvider = 'google') => {
    try {
      console.log(`🤖 Context Service: Processing batch of ${entries.length} entries in ${lang.toUpperCase()}`);

      const requests = entries
        .map(entry => entry['REDACTEDQUESTION']);
      const SYSTEM_PROMPT = await loadContextSystemPrompt(lang);

      const searchResults = [];
      for (let i = 0; i < requests.length; i++) {
        if (searchProvider === 'canadaca' && i > 0 && i % 10 === 0) {
          console.log('Pausing for a minute to avoid rate limits for canadaca...');
          await new Promise(resolve => setTimeout(resolve, 60000)); // Wait for 1 minute
        }
        searchResults.push(await ContextService.contextSearch(requests[i], searchProvider));
      }

      const updatedRequests = requests.map((request, index) => ({
        message: request,
        systemPrompt: SYSTEM_PROMPT,
        searchResults: searchResults[index],
      }));

      const response = await ContextService.sendBatch(updatedRequests, aiService, batchName, lang);
      return {
        batchId: response.batchId,
        batchStatus: response.batchStatus
      };

    } catch (error) {
      console.error('Error deriving context batch:', error);
      throw error;
    }
  },


  sendBatch: async (requests, aiService, batchName, lang) => {
    try {
      const response = await fetch(getProviderApiUrl(aiService, "batch-context"), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests,
          aiService,
          batchName,
          lang,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Context API batch error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error calling Context API batch:', error);
      throw error;
    }
  }
};

export default ContextService;