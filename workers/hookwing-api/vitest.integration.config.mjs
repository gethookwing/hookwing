import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: {
          OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318/v1/traces',
          OTEL_SAMPLE_RATE: '1.0',
        },
      },
    }),
  ],
  test: {
    name: 'integration',
    include: ['test/integration/**/*.test.ts'],
    globals: true,
    testTimeout: 15000,
  },
});
