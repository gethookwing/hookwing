import { defineConfig } from 'vitest/config';

// Contract tests run against real Docker services (span-asserter, otel-collector, mock-receiver).
// Requires docker-compose.test.yml to be running before executing.
export default defineConfig({
  test: {
    name: 'contract',
    include: ['test/contract/**/*.test.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 30000,
  },
});
