import { describe, it, expect } from 'vitest';
import { parseResponse, parseSentences } from '../responseParser.js';


describe('parseSentences', () => {
  it('parses tagged sentences', () => {
    const text = '<s-1>Hello.</s-1> <s-2>World!</s-2>';
    expect(parseSentences(text)).toEqual(['Hello.', 'World!']);
  });

  it('returns full text if no tags', () => {
    const text = 'Just a single sentence.';
    expect(parseSentences(text)).toEqual(['Just a single sentence.']);
  });

  it('returns empty array for empty string', () => {
    expect(parseSentences('')).toEqual([]);
  });
});

describe('parseResponse', () => {
  it('returns default for empty input', () => {
    expect(parseResponse('')).toEqual({
      answerType: 'normal',
      content: '',
      preliminaryChecks: null,
      englishAnswer: null
    });
  });

  it('parses preliminary checks and question language', () => {
    const text = '<preliminary-checks>\n<question-language>fr</question-language>\n<english-question>What is the law?</english-question>\n</preliminary-checks>\n<answer>La loi est ...</answer>';
    const result = parseResponse(text);
    expect(result.preliminaryChecks).toContain('question-language');
    expect(result.questionLanguage).toBe('fr');
    expect(result.englishQuestion).toBe('What is the law?');
    expect(result.content).toBe('La loi est ...');
  });

  it('parses citation fields', () => {
    const text = '<citation-head>Head</citation-head>\n<citation-url>http://url</citation-url>\n<answer>Answer</answer>';
    const result = parseResponse(text);
    expect(result.citationHead).toBe('Head');
    expect(result.citationUrl).toBe('http://url');
  });

  it('parses confidence rating', () => {
    const text = '<confidence>high</confidence>\n<answer>Answer</answer>';
    const result = parseResponse(text);
    expect(result.confidenceRating).toBe('high');
  });

  it('parses special tags (not-gc, pt-muni, clarifying-question)', () => {
    const text = '<answer><not-gc>Not GC content</not-gc></answer>';
    const result = parseResponse(text);
    expect(result.answerType).toBe('not-gc');
    expect(result.content).toBe('Not GC content');
  });

  it('parses paragraphs and sentences', () => {
    const text = '<answer>First paragraph.\n\nSecond paragraph. <s-1>Sentence 1.</s-1> <s-2>Sentence 2.</s-2></answer>';
    const result = parseResponse(text);
    expect(result.paragraphs.length).toBeGreaterThan(1);
    expect(result.sentences).toContain('Sentence 1.');
    expect(result.sentences).toContain('Sentence 2.');
  });

  it('parses department and departmentUrl', () => {
    const text = '<department>Justice</department>\n<departmentUrl>http://justice.gc.ca</departmentUrl>\n<answer>Answer</answer>';
    const result = parseResponse(text);
    expect(result.department).toBe('Justice');
    expect(result.departmentUrl).toBe('http://justice.gc.ca');
  });
});
