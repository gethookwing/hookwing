import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: '../shared/src/db/schema.ts',
  out: '../../migrations',
  dialect: 'sqlite',
});
