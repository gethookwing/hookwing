import { type Workspace, apiKeys, workspaces } from '@hookwing/shared';
import { verifyApiKey } from '@hookwing/shared';
import { eq } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';
import { createDb } from '../db';

/**
 * Extended context with auth info
 */
export interface AuthContext {
  workspace: Workspace;
  apiKey: {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string[] | null;
  };
}

/**
 * Extract and verify API key from Authorization header
 */
export const authMiddleware: MiddlewareHandler<{
  Bindings: { DB: D1Database };
  Variables: { workspace: Workspace; apiKey: AuthContext['apiKey'] };
}> = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    return c.json({ error: 'Unauthorized', message: 'Missing Authorization header' }, 401);
  }

  const [scheme, key] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !key) {
    return c.json({ error: 'Unauthorized', message: 'Invalid Authorization header format' }, 401);
  }

  if (key.length < 12) {
    return c.json({ error: 'Unauthorized', message: 'Invalid API key format' }, 401);
  }

  const prefix = key.substring(0, 12);

  const db = createDb(c.env.DB);
  const keyRecord = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyPrefix, prefix))
    .limit(1)
    .then((rows) => rows[0]);

  if (!keyRecord) {
    return c.json({ error: 'Unauthorized', message: 'Invalid API key' }, 401);
  }

  if (!keyRecord.isActive) {
    return c.json({ error: 'Unauthorized', message: 'API key has been revoked' }, 401);
  }

  if (keyRecord.expiresAt && keyRecord.expiresAt < Date.now()) {
    return c.json({ error: 'Unauthorized', message: 'API key has expired' }, 401);
  }

  const isValid = await verifyApiKey(key, keyRecord.keyHash);
  if (!isValid) {
    return c.json({ error: 'Unauthorized', message: 'Invalid API key' }, 401);
  }

  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, keyRecord.workspaceId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!workspace) {
    return c.json({ error: 'Unauthorized', message: 'Workspace not found' }, 401);
  }

  await db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.id, keyRecord.id));

  let scopes: string[] | null = null;
  if (keyRecord.scopes) {
    try {
      scopes = JSON.parse(keyRecord.scopes);
    } catch {
      scopes = null;
    }
  }

  c.set('workspace', workspace);
  c.set('apiKey', {
    id: keyRecord.id,
    name: keyRecord.name,
    keyPrefix: keyRecord.keyPrefix,
    scopes,
  });

  return await next();
};

/**
 * Helper to get the authenticated workspace from context
 */
export function getWorkspace(c: Context): Workspace {
  const workspace = c.get('workspace');
  if (!workspace) {
    throw new Error('Workspace not found in context - auth middleware may not have run');
  }
  return workspace;
}

/**
 * Helper to get the authenticated API key info from context
 */
export function getApiKey(c: Context): AuthContext['apiKey'] {
  const apiKey = c.get('apiKey');
  if (!apiKey) {
    throw new Error('API key not found in context - auth middleware may not have run');
  }
  return apiKey;
}
