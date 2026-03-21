import { events, apiKeys, deliveries, endpoints, usageDaily, workspaces } from '@hookwing/shared';
import { drizzle } from 'drizzle-orm/d1';

const schema = {
  workspaces,
  apiKeys,
  endpoints,
  events,
  deliveries,
  usageDaily,
};

export { schema };

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Database = ReturnType<typeof createDb>;
