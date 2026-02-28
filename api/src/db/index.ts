import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export { schema };
export type Database = ReturnType<typeof drizzle>;

export function createDbClient(db: D1Database) {
	return drizzle(db, { schema });
}
