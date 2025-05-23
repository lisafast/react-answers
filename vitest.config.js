import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8'
    },
    setupFiles: ['./test/setup.js'],
    globalSetup: ['./test/setup.js'],
    testTimeout: 20000 // Increase timeout for MongoDB operations
  }
});
