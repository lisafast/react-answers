
/**
 * Parses sentence tags like <s-1>...</s-1> from text.
 * @param {string} text - The text containing sentence tags.
 * @returns {Array<string>} An array of 4 strings, containing sentences or empty strings.
 */
const parseSentences = (text) => {
  const sentenceRegex = /<s-(\d+)>(.*?)<\/s-\d+>/g;
  const sentences = [];
  let match;

  while ((match = sentenceRegex.exec(text)) !== null) {
    if (match[2].trim()) {
      sentences.push(match[2].trim());
    }
  }

  // If no sentence tags found, treat entire text as a single sentence
  if (sentences.length === 0 && text.trim()) {
    sentences.push(text.trim());
  }

  return sentences;
};




/**
 * Parses the raw LLM response text to extract structured information.
 * @param {string} text - The raw response text from the LLM.
 * @returns {object} An object containing parsed fields like answerType, content, etc.
 */
const parseResponse = (text) => {
  if (!text) {
    return { answerType: 'normal', content: '', preliminaryChecks: null, englishAnswer: null };
  }

  let answerType = 'normal';
  let content = text;
  let preliminaryChecks = null;
  let englishAnswer = null;
  let citationHead = null;
  let citationUrl = null;
  let confidenceRating = null;
  let englishQuestion = '';

  // Extract preliminary checks - this regex needs to capture multiline content
  let questionLanguage = '';
  const preliminaryMatch = /<preliminary-checks>([\s\S]*?)<\/preliminary-checks>/s.exec(text);
  if (preliminaryMatch) {
    preliminaryChecks = preliminaryMatch[1].trim();
    content = content.replace(/<preliminary-checks>[\s\S]*?<\/preliminary-checks>/s, '').trim();
    const questionLanguageMatch = /<question-language>(.*?)<\/question-language>/s.exec(preliminaryChecks);
    questionLanguage = questionLanguageMatch ? questionLanguageMatch[1].trim() : '';
    const englishQuestionMatch = /<english-question>(.*?)<\/english-question>/s.exec(
      preliminaryChecks
    );
    englishQuestion = englishQuestionMatch ? englishQuestionMatch[1].trim() : '';
  }

  // Extract citation information before processing answers
  const citationHeadMatch = /<citation-head>(.*?)<\/citation-head>/s.exec(content);
  const citationUrlMatch = /<citation-url>(.*?)<\/citation-url>/s.exec(content);

  if (citationHeadMatch) {
    citationHead = citationHeadMatch[1].trim();
  }
  if (citationUrlMatch) {
    citationUrl = citationUrlMatch[1].trim();
  }

      // Extract English answer first
      const englishMatch = /<english-answer>([\s\S]*?)<\/english-answer>/s.exec(content);
      if (englishMatch) {
          englishAnswer = englishMatch[1].trim();
          content = englishAnswer;  // Use English answer as content for English questions
      }

      // Extract main answer if it exists
      const answerMatch = /<answer>([\s\S]*?)<\/answer>/s.exec(text);
      if (answerMatch) {
          content = answerMatch[1].trim();
      }
      content = content.replace(/<citation-head>[\s\S]*?<\/citation-head>/s, '').trim();
      content = content.replace(/<citation-url>[\s\S]*?<\/citation-url>/s, '').trim();
      content = content.replace(/<confidence>(.*?)<\/confidence>/s, '').trim();

      // Check for special tags in either english-answer or answer content
      // These can appear in any order and don't need to wrap the entire content
      const specialTags = {
          'not-gc': /<not-gc>([\s\S]*?)<\/not-gc>/,
          'pt-muni': /<pt-muni>([\s\S]*?)<\/pt-muni>/,
          'clarifying-question': /<clarifying-question>([\s\S]*?)<\/clarifying-question>/
      };

      // Check each special tag type and extract their content
      for (const [type, regex] of Object.entries(specialTags)) {
          // Check both englishAnswer and content for the tag
          const englishMatch = englishAnswer && regex.exec(englishAnswer);
          const contentMatch = content && regex.exec(content);
          
          if (englishMatch || contentMatch) {
              answerType = type;
              // Preserve the content inside the tags
              if (englishMatch) {
                  englishAnswer = englishMatch[1].trim();
              }
              if (contentMatch) {
                  content = contentMatch[1].trim();
              }
              break; // First matching tag type wins
          }
      }

      const confidenceRatingRegex = /<confidence>(.*?)<\/confidence>/s;
      const confidenceMatch = text.match(confidenceRatingRegex);

  if (confidenceMatch) {
    confidenceRating = confidenceMatch[1].trim();
  }

  const paragraphs = content.split(/\n+/).map(paragraph => paragraph.trim()).filter(paragraph => paragraph !== '');
  const sentences = parseSentences(content);

  const departmentMatch = text.match(/<department>([\s\S]*?)<\/department>/);
  const departmentUrlMatch = text.match(/<departmentUrl>([\s\S]*?)<\/departmentUrl>/);

  const department = departmentMatch ? departmentMatch[1] : null;
  const departmentUrl = departmentUrlMatch ? departmentUrlMatch[1] : null;

  return {
    answerType,
    content,
    preliminaryChecks,
    englishAnswer,
    citationHead,
    citationUrl,
    paragraphs,
    confidenceRating,
    sentences,
    questionLanguage,
    englishQuestion,
    department,
    departmentUrl,
  };
};

export { parseResponse, parseSentences }; 
