import {
  apiKeys,
  generateApiKey,
  generateId,
  getTierBySlug,
  hashPassword,
  workspaces,
} from '@hookwing/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db';
import { authMiddleware, getApiKey, getWorkspace } from '../middleware/auth';

const auth = new Hono<{ Bindings: { DB?: D1Database } }>();

// ============================================================================
// Validation schemas
// ============================================================================

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  workspaceName: z.string().min(1).optional(),
});

const createKeySchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).optional(),
});

// ============================================================================
// POST /v1/auth/signup - Create workspace + first API key
// ============================================================================

auth.post('/signup', async (c) => {
  const body = await c.req.json();

  // Validate input FIRST (before touching DB)
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { email, password, workspaceName } = parsed.data;

  // Now we can safely access DB
  const db = createDb(c.env.DB);

  // Check for duplicate email
  const existing = await db
    .select()
    .from(workspaces)
    .where(workspaces.email.equals(email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  // Generate workspace slug from email prefix
  const emailPrefix = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const slug = `${emailPrefix}-${generateId('ws').substring(3, 8)}`;

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create workspace
  const workspaceId = generateId('ws');
  const now = Date.now();

  await db.insert(workspaces).values({
    id: workspaceId,
    email: email.toLowerCase(),
    passwordHash,
    name: workspaceName || `${email.split('@')[0]}'s Workspace`,
    slug,
    tierSlug: 'paper-plane',
    createdAt: now,
    updatedAt: now,
  });

  // Generate first API key
  const keyData = await generateApiKey();
  const keyId = generateId('key');

  await db.insert(apiKeys).values({
    id: keyId,
    workspaceId,
    name: 'Default',
    keyHash: keyData.hash,
    keyPrefix: keyData.prefix,
    scopes: null,
    isActive: 1,
    createdAt: now,
  });

  // Get tier info
  const tier = getTierBySlug('paper-plane');

  return c.json(
    {
      workspace: {
        id: workspaceId,
        name: workspaceName || `${email.split('@')[0]}'s Workspace`,
        slug,
        tier: tier,
      },
      apiKey: keyData.key, // Raw key returned ONLY on creation
    },
    201,
  );
});

// ============================================================================
// POST /v1/auth/keys - Create additional API key (authenticated)
// ============================================================================

auth.post('/keys', authMiddleware, async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const body = await c.req.json();

  // Validate input
  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { name, scopes } = parsed.data;

  // Generate API key
  const keyData = await generateApiKey();
  const keyId = generateId('key');
  const now = Date.now();

  await db.insert(apiKeys).values({
    id: keyId,
    workspaceId: workspace.id,
    name,
    keyHash: keyData.hash,
    keyPrefix: keyData.prefix,
    scopes: scopes ? JSON.stringify(scopes) : null,
    isActive: 1,
    createdAt: now,
  });

  return c.json(
    {
      apiKey: {
        id: keyId,
        name,
        prefix: keyData.prefix,
        scopes,
      },
      key: keyData.key, // Raw key returned ONLY on creation
    },
    201,
  );
});

// ============================================================================
// GET /v1/auth/keys - List API keys for workspace (authenticated)
// ============================================================================

auth.get('/keys', authMiddleware, async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);

  const keys = await db.select().from(apiKeys).where(apiKeys.workspaceId.equals(workspace.id));

  // Return keys WITHOUT raw key
  return c.json({
    keys: keys.map((key) => ({
      id: key.id,
      name: key.name,
      prefix: key.keyPrefix,
      scopes: key.scopes ? JSON.parse(key.scopes) : null,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      isActive: Boolean(key.isActive),
      createdAt: key.createdAt,
    })),
  });
});

// ============================================================================
// DELETE /v1/auth/keys/:id - Revoke API key (authenticated)
// ============================================================================

auth.delete('/keys/:id', authMiddleware, async (c) => {
  const workspace = getWorkspace(c);
  const apiKey = getApiKey(c);
  const keyId = c.req.param('id');
  const db = createDb(c.env.DB);

  // Find the key
  const key = await db
    .select()
    .from(apiKeys)
    .where(apiKeys.id.equals(keyId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!key || key.workspaceId !== workspace.id) {
    return c.json({ error: 'API key not found' }, 404);
  }

  // Check if it's the last active key
  const activeKeys = await db
    .select()
    .from(apiKeys)
    .where(apiKeys.workspaceId.equals(workspace.id))
    .and(apiKeys.isActive.equals(1));

  if (activeKeys.length === 1 && activeKeys[0].id === keyId) {
    return c.json({ error: 'Cannot delete the last active API key' }, 400);
  }

  // Soft delete
  await db.update(apiKeys).set({ isActive: 0 }).where(apiKeys.id.equals(keyId));

  return c.json({ success: true });
});

export default auth;
