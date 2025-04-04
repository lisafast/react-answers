import { menuStructure_EN } from '../data/menuStructure/menuStructure_EN.js';
import { menuStructure_FR } from '../data/menuStructure/menuStructure_FR.js';
import checkCitationUrl from './urlChecker.js';

/**
 * URLValidator class provides methods to validate and verify URLs for Canada.ca domains
 * It uses a cached set of known good URLs from the menu structure and performs
 * both static validation and network checks
 */
class URLValidator {
  constructor() {
    // Cache of valid URLs from the menu structure
    this.menuUrls = new Set();
  }

  /**
   * Initialize cache with URLs from menu structure for given language
   * This builds a Set of all known good URLs from the menu structure
   * @param {string} lang - Language code ('en' or 'fr')
   */
  initializeMenuUrls(lang = 'en') {
    // Clear existing cache
    this.menuUrls.clear();
    // Select menu structure based on language
    const menuStructure = lang.toLowerCase() === 'fr' ? menuStructure_FR : menuStructure_EN;

    // Helper function to process each section of the menu
    const processMenuSection = (section) => {
      // Add main section URL if it exists
      if (section.url) {
        this.menuUrls.add(section.url);
      }
      // Add URLs from submenus
      if (section.submenus) {
        Object.values(section.submenus).forEach((url) => {
          if (typeof url === 'string') {
            this.menuUrls.add(url);
          }
        });
      }
      // Add URLs from most requested links
      if (section.mostRequested) {
        Object.values(section.mostRequested).forEach((url) => {
          if (typeof url === 'string') {
            this.menuUrls.add(url);
          }
        });
      }
    };

    // Process all sections in the menu structure
    Object.values(menuStructure).forEach(processMenuSection);
  }

  /**
   * Validate and check URL accessibility
   * @param {string} url - URL to validate and check
   * @param {string} lang - Language code ('en' or 'fr')
   * @param {function} t - Translation function
   * @returns {Promise<object>} Validation result with network check
   */
  async validateAndCheckUrl(url, lang, t) {
    // 1 Perform network validation to see if it is a canada.ca URL that is going to 404
    const checkResult = await checkCitationUrl(url);

    // 2 If the URL isn't 404, return the original URL
    if (checkResult.isValid) {
      return {
        isValid: true,
        url: url, // Keep the original URL
        confidenceRating: '1.0',
      };
    }

    // 3. If 404/invalid, initialize menu and look for fallback
    this.initializeMenuUrls(lang);
    const fallback = this.getFallbackUrl(url, lang);

    if (fallback.confidence > 0.4) {
      return {
        isValid: true,
        url: fallback.url,
        confidenceRating: fallback.confidence.toFixed(1),
      };
    }

    // If no good fallback found, return search page
    return {
      isValid: false,
      fallbackUrl: `https://www.canada.ca/${lang}/sr/srb.html`,
      fallbackText: t('homepage.chat.citation.fallbackText'),
      confidenceRating: '0.1',
    };
  }

  /**
   * Get a fallback URL from the menu structure based on topic if it's 404
   */
  getFallbackUrl(url, lang = 'en') {
    const menuStructure = lang === 'fr' ? menuStructure_FR : menuStructure_EN;
    let bestMatch = { url: '', confidence: 0 };

    // Parse the 404 URL into meaningful segments
    const urlObj = new URL(url);
    const urlSegments = urlObj.pathname
      .split('/')
      .filter((segment) => segment && !['en', 'fr', 'www', 'canada', 'ca'].includes(segment));

    console.log('404 URL segments:', urlSegments);

    // Helper function to compare URL paths
    const compareUrls = (menuUrl) => {
      try {
        const menuUrlObj = new URL(menuUrl);
        const menuSegments = menuUrlObj.pathname
          .split('/')
          .filter((segment) => segment && !['en', 'fr', 'www', 'canada', 'ca'].includes(segment));

        // console.log('Comparing with menu segments:', menuSegments);

        // Count matching segments
        let matchingSegments = 0;
        let partialMatches = 0;

        urlSegments.forEach((segment) => {
          if (menuSegments.includes(segment)) {
            matchingSegments++;
            // console.log(`Exact segment match: ${segment}`);
          } else {
            // Check for partial matches within segments
            for (const menuSegment of menuSegments) {
              if (menuSegment.includes(segment) || segment.includes(menuSegment)) {
                partialMatches++;
                // console.log(`Partial segment match: ${segment} ≈ ${menuSegment}`);
                break;
              }
            }
          }
        });

        // Calculate confidence based on matches
        const confidence =
          (matchingSegments + partialMatches * 0.5) /
          Math.max(urlSegments.length, menuSegments.length);

        // console.log(`Confidence for ${menuUrl}: ${confidence}`);
        return confidence;
      } catch (e) {
        // console.log(`Invalid URL in menu: ${menuUrl}`);
        return 0;
      }
    };

    // Search through menu structure
    Object.entries(menuStructure).forEach(([category, data]) => {
      // Check main category URL
      const mainUrlConfidence = compareUrls(data.url);
      if (mainUrlConfidence > bestMatch.confidence) {
        // console.log(`New best match (category): ${category} - ${data.url}`);
        bestMatch = { url: data.url, confidence: mainUrlConfidence };
      }

      // Check most requested
      if (data.mostRequested) {
        Object.entries(data.mostRequested).forEach(([item, itemUrl]) => {
          if (typeof itemUrl === 'string') {
            const itemConfidence = compareUrls(itemUrl);
            if (itemConfidence > bestMatch.confidence) {
              // console.log(`New best match (most requested): ${item} - ${itemUrl}`);
              bestMatch = { url: itemUrl, confidence: itemConfidence };
            }
          }
        });
      }

      // Check topics
      if (data.topics) {
        Object.entries(data.topics).forEach(([topic, topicUrl]) => {
          if (typeof topicUrl === 'string') {
            const topicConfidence = compareUrls(topicUrl);
            if (topicConfidence > bestMatch.confidence) {
              // console.log(`New best match (topic): ${topic} - ${topicUrl}`);
              bestMatch = { url: topicUrl, confidence: topicConfidence };
            }
          }
        });
      }
    });

    // console.log('Final best match:', bestMatch);
    return bestMatch;
  }
}

// Export a singleton instance
export const urlValidator = new URLValidator();
