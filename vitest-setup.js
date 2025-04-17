// vitest-setup.js

// This file is executed before each test file
// Set up global mocks and configurations here

// Set up mock MongoDB URI for tests that need it
beforeAll(() => {
  global.__MONGO_URI__ = 'mongodb://mock-uri:27017/test-db';
});

// Mock implementations for OpenAI and other providers
vi.mock('openai', () => {
  const mockOpenAI = function() {
    return {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'mock response' } }]
          })
        }
      }
    };
  };
  
  // Properly add the prototype - not as a static property
  mockOpenAI.prototype = { constructor: vi.fn() };
  
  return { OpenAI: mockOpenAI };
});

// Set up mock for AI models config
vi.mock('./config/ai-models.js', () => {
  return {
    getModelConfig: vi.fn().mockImplementation((provider) => {
      return {
        name: 'test-model',
        temperature: 0.5,
        maxTokens: 200,
        timeoutMs: 10000
      };
    }),
    AI_MODELS: {
      openai: { /* mock config */ },
      azure: { /* mock config */ },
      anthropic: { /* mock config */ },
      cohere: { /* mock config */ }
    }
  };
});

process.env.JWT_SECRET = 'testsecret';