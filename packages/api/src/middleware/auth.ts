import { type Workspace, apiKeys, workspaces } from '@hookwing/shared';
import { verifyApiKey } from '@hookwing/shared';
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
 *
 * Sets on context:
 * - c.set('workspace', workspace)
 * - c.set('apiKey', apiKey info)
 */
export const authMiddleware: MiddlewareHandler<{ Bindings: { DB: D1Database } }> = async (
  c,
  next,
) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    return c.json({ error: 'Unauthorized', message: 'Missing Authorization header' }, 401);
  }

  // Expect "Bearer hk_live_..."
  const [scheme, key] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !key) {
    return c.json({ error: 'Unauthorized', message: 'Invalid Authorization header format' }, 401);
  }

  // Extract prefix (first 12 chars: hk_live_xxx)
  if (key.length < 12) {
    return c.json({ error: 'Unauthorized', message: 'Invalid API key format' }, 401);
  }

  const prefix = key.substring(0, 12);

  // Look up key in DB
  const db = createDb(c.env.DB);
  const keyRecord = await db
    .select()
    .from(apiKeys)
    .where(apiKeys.keyPrefix.equals(prefix))
    .limit(1)
    .then((rows) => rows[0]);

  if (!keyRecord) {
    return c.json({ error: 'Unauthorized', message: 'Invalid API key' }, 401);
  }

  // Check if key is active
  if (!keyRecord.isActive) {
    return c.json({ error: 'Unauthorized', message: 'API key has been revoked' }, 401);
  }

  // Check expiration
  if (keyRecord.expiresAt && keyRecord.expiresAt < Date.now()) {
    return c.json({ error: 'Unauthorized', message: 'API key has expired' }, 401);
  }

  // Verify key hash
  const isValid = await verifyApiKey(key, keyRecord.keyHash);
  if (!isValid) {
    return c.json({ error: 'Unauthorized', message: 'Invalid API key' }, 401);
  }

  // Look up workspace
  const workspace = await db
    .select()
    .from(workspaces)
    .where(workspaces.id.equals(keyRecord.workspaceId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!workspace) {
    return c.json({ error: 'Unauthorized', message: 'Workspace not found' }, 401);
  }

  // Update last used timestamp
  await db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(apiKeys.id.equals(keyRecord.id));

  // Parse scopes
  let scopes: string[] | null = null;
  if (keyRecord.scopes) {
    try {
      scopes = JSON.parse(keyRecord.scopes);
    } catch {
      scopes = null;
    }
  }

  // Set on context
  c.set('workspace', workspace);
  c.set('apiKey', {
    id: keyRecord.id,
    name: keyRecord.name,
    keyPrefix: keyRecord.keyPrefix,
    scopes,
  });

  await next();
};

/**
 * Helper to get the authenticated workspace from context
 * @throws Error if workspace is not set (should only happen if auth middleware was not applied)
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
 * @throws Error if apiKey is not set (should only happen if auth middleware was not applied)
 */
export function getApiKey(c: Context): AuthContext['apiKey'] {
  const apiKey = c.get('apiKey');
  if (!apiKey) {
    throw new Error('API key not found in context - auth middleware may not have run');
  }
  return apiKey;
}
