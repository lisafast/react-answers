// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/__tests__/**/*.test.js'],
    setupFiles: ['./vitest-setup.js'],
    testTimeout: 30000 // Increase timeout to 30 seconds
  }
});
