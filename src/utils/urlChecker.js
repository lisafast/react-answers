const checkCitationUrl = async (url) => {
  if (!url) return null;

  // Function to check if a URL is a Canada.ca domain
  const isCanadaCaDomain = (url) => {
    return url.startsWith('https://www.canada.ca') || url.startsWith('http://www.canada.ca');
  };

  // If not a Canada.ca domain, return early with basic validation
  if (!isCanadaCaDomain(url)) {
    return {
      isValid: true,
      url: url,
      confidenceRating: 0.25,
    };
  }

  // Define known 404 pages
  const notFoundPages = [
    'https://www.canada.ca/errors/404.html',
    'https://www.canada.ca/fr/erreurs/404.html',
  ];

  try {
    // First try with cors mode
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
    });

    // Check if the final URL (after potential redirects) is a known 404 page
    if (notFoundPages.some((notFoundUrl) => response.url.includes(notFoundUrl))) {
      return { isValid: false };
    }

    // Check for 404 status
    if (response.status === 404) {
      return { isValid: false };
    }

    return {
      isValid: true,
      url: response.url,
      confidenceRating: 1,
    };
  } catch (error) {
    // If we get a CORS error, try again with no-cors mode
    if (error.toString().includes('CORS')) {
      try {
        await fetch(url, {
          method: 'GET',
          mode: 'no-cors',
          credentials: 'omit',
        });

        // If we reach here, the request succeeded (though we can't see the response details)
        return {
          isValid: true,
          url: url,
          confidenceRating: 0.75, // Slightly lower confidence since we couldn't fully validate
        };
      } catch (secondError) {
        console.error('Error checking Canada.ca URL (no-cors):', secondError);
        return { isValid: false };
      }
    }

    console.error('Error checking Canada.ca URL:', error);
    return { isValid: false };
  }
};

export default checkCitationUrl;
