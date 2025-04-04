import { google } from 'googleapis';
import { tool } from "@langchain/core/tools";

const customsearch = google.customsearch('v1');


/**
 * Extracts search results from Google Custom Search API response.
 * @param {object} results - The search results from Google Custom Search API.
 * @param {number} numResults - The number of top results to extract.
 * @returns {string} - The formatted top search results with summary, link, and link text.
 */
function extractSearchResults(results, numResults = 3) {
    if (!results?.items || results.items.length === 0) {
        console.info("No search results found");
        return "No results found.";
    }

    const topResults = results.items.slice(0, numResults).map(result => ({
        link: result.link,
        linkText: result.title,
        summary: result.snippet
    }));

    const extractedResults = topResults.map(result =>
        `Title: ${result.linkText}\nLink: ${result.link}\nSummary: ${result.summary}\n`
    ).join("\n");
    console.info("Extracted search results:", extractedResults);
    return extractedResults;
}

/**
 * @param {string} query - The search query.
 * @param {string} lang - The language of the search query.
 * @returns {object|null} - The Google search results.
 */
const contextSearch = async (query, lang) => {
    try {
        const CX = process.env.GOOGLE_SEARCH_ENGINE_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;

        if (!CX || !API_KEY) {
            throw new Error("Missing required environment variables: GOOGLE_SEARCH_ENGINE_ID or GOOGLE_API_KEY");
        }

        // You can use the lang parameter to customize the search if needed
        // For example, to restrict results to a specific language
        const searchOptions = {
            cx: CX,
            q: query,
            key: API_KEY
        };
        
        // Add language restriction if specified
        if (lang) {
            searchOptions.lr = lang.toLowerCase().startsWith('fr') ? 'lang_fr' : 'lang_en';
        }

        const res = await customsearch.cse.list(searchOptions);
        const results = res.data;
        const extractedResults = extractSearchResults(results);
        return {
            results: extractedResults,
            provider: "google"
        };
    } catch (error) {
        console.error("Error performing Google search:", error);
        return {
            results: "Search failed: " + error.message,
            provider: "google"
        };
    }
};

const googleContextSearch = tool(
    async ({ query, lang }) => {
        return await contextSearch(query, lang);
    },
    {
        name: "contextSearch",
        description: "Perform a search on Google Custom Search. Provide 'query' as the search term and 'lang' as the language.",
        schema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search term to query on.",
                },
                lang: {
                    type: "string",
                    description: "The language of the search query (e.g., 'en' or 'fr').",
                }
            },
            required: ["query"],
        },
    }
);

export { googleContextSearch, contextSearch };
