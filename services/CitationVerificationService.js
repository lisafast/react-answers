import ServerLoggingService from './ServerLoggingService.js';
// Assuming urlValidator is the core logic provider based on our analysis
import { urlValidator } from '../utils/urlValidator.js';

/**
 * Service responsible for verifying citation URLs, checking their validity,
 * and finding suitable fallbacks if necessary, specifically for Canada.ca domains.
 */
class CitationVerificationService {
  /**
   * Verifies a citation URL.
   * - Checks if the URL is live and not a known 404 page.
   * - If invalid (e.g., 404), attempts to find a fallback URL from the menu structure.
   * - Returns the validation result including the final URL (original or fallback)
   *   and a confidence rating.
   *
   * @param {string | null | undefined} originalCitationUrl - The URL provided by the agent.
   * @param {string} lang - The language code ('en' or 'fr').
   * @param {string} chatId - Optional chat ID for logging.
   * @returns {Promise<{finalCitationUrl: string | null, confidenceRating: string | null}>} - Object containing the verified/fallback URL and confidence.
   */
  async verifyCitation(originalCitationUrl, lang, chatId = 'system') {
    if (!originalCitationUrl) {
      ServerLoggingService.debug('No citation URL provided for verification', chatId);
      return { finalCitationUrl: null, confidenceRating: null };
    }

    try {
      // Directly use urlValidator's method.
      // Note: We are omitting the 't' function (translation) for now,
      // as it's not readily available in ChatProcessingService and primarily affects fallbackText.
      // If fallbackText is needed later, this will need adjustment.
      const validationResult = await urlValidator.validateAndCheckUrl(originalCitationUrl, lang /*, t */);

      ServerLoggingService.debug('Citation validation result', chatId, { originalCitationUrl, validationResult });

      // Determine the final URL and confidence based on the validation result
      let finalCitationUrl = null;
      let confidenceRating = null;

      if (validationResult.isValid) {
        // If valid, use the URL returned by the validator (might be the original or a redirect)
        finalCitationUrl = validationResult.url;
        confidenceRating = validationResult.confidenceRating;
      } else if (validationResult.fallbackUrl) {
        // If invalid but a fallback was found
        finalCitationUrl = validationResult.fallbackUrl;
        confidenceRating = validationResult.confidenceRating;
        ServerLoggingService.info('Using fallback URL for citation', chatId, { originalCitationUrl, fallbackUrl: finalCitationUrl, confidence: confidenceRating });
      } else {
        // If invalid and no fallback found (should ideally not happen if validator always returns a fallback)
        ServerLoggingService.warn('Citation URL invalid and no fallback provided by validator', chatId, { originalCitationUrl });
        // Keep URL null, maybe set lowest confidence? Validator seems to return 0.1 in this case.
        confidenceRating = validationResult.confidenceRating || '0.1';
      }

      // Ensure confidenceRating is a string as expected by the schema/downstream processing
      if (typeof confidenceRating === 'number') {
        confidenceRating = confidenceRating.toFixed(1);
      }


      return {
        finalCitationUrl: finalCitationUrl,
        confidenceRating: confidenceRating,
      };

    } catch (error) {
      ServerLoggingService.error('Error during citation verification', chatId, { originalCitationUrl, error: error.message, stack: error.stack });
      // Return nulls or a default low confidence if an unexpected error occurs
      return {
        finalCitationUrl: originalCitationUrl, // Return original on error? Or null? Let's return original for now.
        confidenceRating: '0.0', // Indicate failure/uncertainty
      };
    }
  }
}

// Export a singleton instance
export default new CitationVerificationService();
