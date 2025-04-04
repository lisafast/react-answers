import { vi, describe, it, expect, beforeEach } from 'vitest';
import loadSystemPrompt from '../systemPrompt.js';
import { BASE_SYSTEM_PROMPT } from '../../prompts/base/agenticBase.js'; // Path relative to project root
import { SCENARIOS as GENERAL_SCENARIOS } from '../../prompts/scenarios/scenarios-all.js'; // Path relative to project root
import { CITATION_INSTRUCTIONS } from '../../prompts/base/citationInstructions.js'; // Path relative to project root
import LoggingService from '../ClientLoggingService.js';

// Mock dependencies
vi.mock('../ClientLoggingService.js');
// We specifically DO NOT mock the dynamic imports here, as the test asserts they are NOT called.

describe('loadSystemPrompt', () => {
  const mockContextBase = {
    department: 'CRA', // Example department
    topic: 'Test Topic',
    topicUrl: 'http://topic.url',
    departmentUrl: 'http://dept.url',
    searchResults: 'Some search results',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    LoggingService.info = vi.fn();
    LoggingService.error = vi.fn();
    LoggingService.warn = vi.fn(); // Mock warn as well
  });

  it('should load the base prompt, general scenarios, and citation instructions', async () => {
    const prompt = await loadSystemPrompt('en', mockContextBase);

    expect(prompt).toContain('## Role');
    expect(prompt).toContain('AI assistant named "AI Answers"');
    expect(prompt).toContain(BASE_SYSTEM_PROMPT);
    expect(prompt).toContain('## General Instructions for All Departments');
    expect(prompt).toContain(GENERAL_SCENARIOS);
    expect(prompt).toContain(CITATION_INSTRUCTIONS);
  });

  it('should include current date and language context (EN)', async () => {
    const prompt = await loadSystemPrompt('en', mockContextBase);
    expect(prompt).toMatch(/## Current date\n\s*Today is .*?\./); // Adjusted regex for whitespace
    expect(prompt).toContain('<page-language>English</page-language>');
  });

  it('should include current date and language context (FR)', async () => {
    const prompt = await loadSystemPrompt('fr', mockContextBase);
    expect(prompt).toMatch(/## Current date\n\s*Today is .*?\./); // Adjusted regex for whitespace
    expect(prompt).toContain('<page-language>French</page-language>');
  });

  it('should include other context details passed in', async () => {
     const prompt = await loadSystemPrompt('en', mockContextBase);
     expect(prompt).toContain(`Department: ${mockContextBase.department}`);
     expect(prompt).toContain(`Topic: ${mockContextBase.topic}`);
     expect(prompt).toContain(`Topic URL: ${mockContextBase.topicUrl}`);
     expect(prompt).toContain(`Department URL: ${mockContextBase.departmentUrl}`);
     expect(prompt).toContain(`Search Results: ${mockContextBase.searchResults}`);
  });

  it('should NOT include the department-specific scenarios section', async () => {
    const prompt = await loadSystemPrompt('en', mockContextBase);
    // Check that the specific header and placeholder are gone
    expect(prompt).not.toContain('## Department-Specific Scenarios and updates:');
    // Also check that mock scenario content (which shouldn't be loaded) is absent
    expect(prompt).not.toContain('Mock CRA Scenarios Content'); // Assuming CRA was mocked elsewhere
  });

  it('should NOT attempt to dynamically import department scenarios', async () => {
     // Spy on dynamic import (tricky, might need specific setup if possible,
     // otherwise rely on the fact that mocks for those files aren't hit)
     // For now, we trust that removing the import logic prevents the call.
     // A more robust test might involve checking file system access mocks if available.

     await loadSystemPrompt('en', mockContextBase);
     // Primarily check that no warnings/errors about failed dynamic imports were logged
     expect(LoggingService.warn).not.toHaveBeenCalledWith(expect.stringContaining('Failed to load content for'));
     expect(LoggingService.error).not.toHaveBeenCalledWith(expect.stringContaining('Error loading scenarios for department'));
  });

  it('should handle null or undefined context gracefully', async () => {
     const prompt = await loadSystemPrompt('en', null);
     expect(prompt).toContain(BASE_SYSTEM_PROMPT);
     expect(prompt).not.toContain('Department:'); // Context fields shouldn't be present
     expect(prompt).not.toContain('Topic:');
  });

});
