import {
  apiKeys,
  generateApiKey,
  generateId,
  getTierBySlug,
  hashPassword,
  verifyPassword,
  workspaces,
} from '@hookwing/shared';
import { and, eq } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db';
import { authMiddleware, getWorkspace } from '../middleware/auth';
import { createRateLimitMiddleware } from '../middleware/rateLimit';

type AuthBindings = {
  DB?: D1Database;
};

const auth = new Hono<{ Bindings: AuthBindings }>();
const AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;

// ============================================================================
// Validation schemas
// ============================================================================

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  workspaceName: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const createKeySchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).optional(),
});

function getClientIp(c: Context): string {
  const forwardedFor = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For');
  const candidate = forwardedFor?.split(',')[0]?.trim() || c.req.header('X-Real-IP')?.trim();
  return candidate && candidate.length > 0 ? candidate : 'unknown';
}

const authAbuseProtection = createRateLimitMiddleware({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  keyFn: (c) => {
    const action = c.req.path.endsWith('/signup') ? 'signup' : 'login';
    return `auth:${action}:${getClientIp(c)}`;
  },
  getLimit: () => AUTH_RATE_LIMIT_MAX_ATTEMPTS,
});

// ============================================================================
// POST /v1/auth/signup - Create workspace + first API key
// ============================================================================

auth.use('/signup', authAbuseProtection);
auth.post('/signup', async (c) => {
  const body = await c.req.json();

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { email, password, workspaceName } = parsed.data;

  if (!c.env?.DB) {
    return c.json({ error: 'Database not configured' }, 503);
  }
  const db = createDb(c.env.DB);

  const existing = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const emailPrefix =
    email
      .split('@')[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') ?? 'user';
  const slug = `${emailPrefix}-${generateId('ws').substring(3, 8)}`;

  const passwordHash = await hashPassword(password);

  const workspaceId = generateId('ws');
  const now = Date.now();

  await db.insert(workspaces).values({
    id: workspaceId,
    email: email.toLowerCase(),
    passwordHash,
    name: workspaceName ?? `${email.split('@')[0]}'s Workspace`,
    slug,
    tierSlug: 'paper-plane',
    createdAt: now,
    updatedAt: now,
  });

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

  const tier = getTierBySlug('paper-plane');

  return c.json(
    {
      workspace: {
        id: workspaceId,
        name: workspaceName ?? `${email.split('@')[0]}'s Workspace`,
        slug,
        tier,
      },
      apiKey: keyData.key,
    },
    201,
  );
});

// ============================================================================
// POST /v1/auth/login - Authenticate and get API key
// ============================================================================

auth.use('/login', authAbuseProtection);
auth.post('/login', async (c) => {
  const body = await c.req.json();

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { email, password } = parsed.data;

  if (!c.env?.DB) {
    return c.json({ error: 'Database not configured' }, 503);
  }
  const db = createDb(c.env.DB);

  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.email, email.toLowerCase()))
    .limit(1)
    .then((rows) => rows[0]);

  if (!workspace) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const isValid = await verifyPassword(password, workspace.passwordHash);
  if (!isValid) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Get first active API key or create a new session key
  const existingKeys = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.workspaceId, workspace.id), eq(apiKeys.isActive, 1)))
    .limit(1)
    .then((rows) => rows[0]);

  let apiKey: string;

  if (existingKeys) {
    // Return the existing key (we can't return the full key, so generate a new one)
    // Actually, we need to return a usable key. Let's check if there's a way to get it.
    // The key is hashed, so we can't return it. We need to generate a new one.
    const keyData = await generateApiKey();
    const keyId = generateId('key');
    const now = Date.now();

    await db.insert(apiKeys).values({
      id: keyId,
      workspaceId: workspace.id,
      name: 'Dashboard Session',
      keyHash: keyData.hash,
      keyPrefix: keyData.prefix,
      scopes: null,
      isActive: 1,
      createdAt: now,
    });

    apiKey = keyData.key;
  } else {
    const keyData = await generateApiKey();
    const keyId = generateId('key');
    const now = Date.now();

    await db.insert(apiKeys).values({
      id: keyId,
      workspaceId: workspace.id,
      name: 'Dashboard Session',
      keyHash: keyData.hash,
      keyPrefix: keyData.prefix,
      scopes: null,
      isActive: 1,
      createdAt: now,
    });

    apiKey = keyData.key;
  }

  const tier = getTierBySlug(workspace.tierSlug);

  return c.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      email: workspace.email,
      tier,
      createdAt: workspace.createdAt,
    },
    apiKey,
  });
});

// ============================================================================
// GET /v1/auth/me - Get current workspace info (authenticated)
// ============================================================================

auth.get('/me', authMiddleware, async (c) => {
  const workspace = getWorkspace(c);
  const tier = getTierBySlug(workspace.tierSlug);

  return c.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      email: workspace.email,
      tier,
      createdAt: workspace.createdAt,
    },
  });
});

// ============================================================================
// POST /v1/auth/keys - Create additional API key (authenticated)
// ============================================================================

auth.post('/keys', authMiddleware, async (c) => {
  const workspace = getWorkspace(c);
  const db = createDb(c.env.DB);
  const body = await c.req.json();

  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { name, scopes } = parsed.data;

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
      key: keyData.key,
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

  const keys = await db.select().from(apiKeys).where(eq(apiKeys.workspaceId, workspace.id));

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
  const keyId = c.req.param('id');
  const db = createDb(c.env.DB);

  const key = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!key || key.workspaceId !== workspace.id) {
    return c.json({ error: 'API key not found' }, 404);
  }

  const activeKeys = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.workspaceId, workspace.id), eq(apiKeys.isActive, 1)));

  if (activeKeys.length === 1 && activeKeys[0]?.id === keyId) {
    return c.json({ error: 'Cannot delete the last active API key' }, 400);
  }

  await db.update(apiKeys).set({ isActive: 0 }).where(eq(apiKeys.id, keyId));

  return c.json({ success: true });
});

export default auth;
