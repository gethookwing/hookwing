import { defineConfig } from 'vitest/config';

// Unit and contract tests run in Node environment.
// Integration tests have a separate config (vitest.integration.config.ts)
// that uses the @cloudflare/vitest-pool-workers pool.
export default defineConfig({
  test: {
    name: 'unit',
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
});
