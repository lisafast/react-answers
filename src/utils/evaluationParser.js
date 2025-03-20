export const parseEvaluationResponse = (text, aiService) => {
  const citationUrlRegex = /<citation-url>(.*?)<\/citation-url>/;
  const confidenceRatingRegex = /<confidence>(.*?)<\/confidence>/;

  const urlMatch = text.match(citationUrlRegex);
  const confidenceMatch = text.match(confidenceRatingRegex);

  return {
    citationUrl: urlMatch ? urlMatch[1] : null,
    confidenceRating: confidenceMatch ? confidenceMatch[1] : null,
  };
};
