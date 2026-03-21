# ENGINEERING.md — Engineering Standards & Conventions

> **Agent-first development.** This document guides all engineering decisions. See [CLAUDE.md](./CLAUDE.md) for project-specific context.

---

## 1. Overview & Philosophy

### Core Principles

| Principle | Description |
|-----------|-------------|
| **SOLID** | Single responsibility, Open/closed, Liskov substitution, Interface segregation, Dependency inversion |
| **YAGNI** | Don't implement features until they're actually needed |
| **KISS** | Keep solutions simple and readable |
| **DRY** | Avoid duplication; extract common patterns into shared utilities |

### Agent-First Development

Build for AI agents as first-class users, not just human developers:

```typescript
// Agents need clear, machine-readable contracts
interface WebhookHandler {
  handle(event: WebhookEvent): Promise<Result<SuccessResponse, ErrorResponse>>;
}

// Explicit schemas help agents understand and validate data
const WebhookEventSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['webhook.created', 'webhook.delivered', 'webhook.failed']),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime(),
});
```

### Config-Driven Architecture

Behavior changes via configuration, not code:

```typescript
// NEVER: if (tier === 'pro') { /* enable feature */ }

// ALWAYS: feature flags and tier permissions in config
const config = {
  tiers: {
    free: { maxWebhooks: 5, retries: 3 },
    pro: { maxWebhooks: 50, retries: 5 },
    enterprise: { maxWebhooks: -1, retries: 10 },
  },
};

const canUse = (user: User, feature: Feature) =>
  config.tiers[user.tier].features[feature];
```

---

## 2. TypeScript Standards

### Strict Mode

Always use `strict: true` in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### No `any`

Never use `any`. Use `unknown` when type is truly unknown:

```typescript
// BAD
function parse(data: any): any { ... }

// GOOD
function parse<T>(data: unknown): T {
  if (!isObject(data)) throw new Error('Invalid data');
  return data as T;
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Variables, functions | camelCase | `getUserById`, `webhookConfig` |
| Types, interfaces, classes | PascalCase | `User`, `WebhookHandler` |
| Constants | UPPER_SNAKE | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT` |
| Files | kebab-case | `webhook-handler.ts`, `api-client.ts` |
| Enums (members) | PascalCase | `WebhookStatus.Pending` |
| Database tables/columns | snake_case | `webhook_configs`, `created_at` |

---

## 3. Monorepo Structure

### Turborepo Setup

```
hookwing/
├── packages/
│   ├── api/           # Cloudflare Workers API
│   ├── shared/        # Shared types, schemas, utilities
│   └── config/        # Runtime configuration schemas
├── website/           # Marketing site + blog
├── turbo.json         # Turborepo config
├── package.json       # Root workspace config
└── pnpm-workspace.yaml
```

### Cross-Package Imports

Use workspace protocol for internal packages:

```json
{
  "dependencies": {
    "@hookwing/shared": "workspace:*",
    "@hookwing/config": "workspace:*"
  }
}
```

### NPM Scripts (Root)

```bash
pnpm build            # Build all packages
pnpm build --filter=api    # Build specific package
pnpm test             # Test all packages
pnpm lint             # Lint all packages
pnpm --filter api dev # Run dev for api package
```

---

## 4. API Patterns

### Hono Routing

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { webhookRoutes } from './routes/webhooks';
import { healthRoutes } from './routes/health';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('*', cors({
  origin: ['https://hookwing.com', 'https://dev.hookwing.com'],
  credentials: true,
}));

app.route('/webhooks', webhookRoutes);
app.route('/health', healthRoutes);

app.notFound((c) => c.json({ error: 'Not Found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
```

### Middleware Chain

```typescript
import { createMiddleware } from 'hono/factory';

// Request ID middleware
export const requestId = createMiddleware(async (c, next) => {
  c.set('requestId', c.req.header('X-Request-ID') || crypto.randomUUID());
  await next();
});

// Auth middleware
export const requireAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  const user = await validateToken(token, c.env);
  if (!user) return c.json({ error: 'Invalid token' }, 401);

  c.set('user', user);
  await next();
});
```

### Request Validation with Zod

```typescript
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';

const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  name: z.string().max(100).optional(),
  secret: z.string().optional(),
});

type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>;

async function createWebhook(c: Context, input: CreateWebhookInput) {
  const validated = CreateWebhookSchema.safeParse(input);
  if (!validated.success) {
    throw new HTTPException(400, {
      message: 'Validation failed',
      cause: validated.error.flatten(),
    });
  }

  // Proceed with validated data
  const webhook = await db.webhooks.create({
    ...validated.data,
    userId: c.get('user').id,
  });

  return c.json({ webhook }, 201);
}
```

### Error Handling

```typescript
// Result type for explicit error handling
type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

// Always return Result from service functions
async function getWebhook(id: string): Promise<Result<Webhook, NotFoundError>> {
  const webhook = await db.webhooks.findUnique({ where: { id } });
  if (!webhook) {
    return { ok: false, error: new NotFoundError(`Webhook ${id} not found`) };
  }
  return { ok: true, data: webhook };
}

// Handler unwraps Result
app.get('/webhooks/:id', async (c) => {
  const result = await getWebhook(c.req.param('id'));
  if (!result.ok) {
    return c.json({ error: result.error.message }, 404);
  }
  return c.json(result.data);
});
```

---

## 5. Database

### D1 + Drizzle ORM

```typescript
import { drizzle } from 'drizzle-orm/d1';
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Schema definitions in shared package
export const webhooks = sqliteTable('webhooks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  url: text('url').notNull(),
  name: text('name'),
  events: text('events', { mode: 'json' }).$type<string[]>(),
  secret: text('secret'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
```

### Migration Strategy

**Sequential migrations with descriptive names:**

```
migrations/
├── 0001_create_users.sql
├── 0002_create_webhooks.sql
├── 0003_add_webhook_events.sql
└── 0004_create_indexes.sql
```

```sql
-- 0002_create_webhooks.sql
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT,
  events TEXT DEFAULT '[]',
  secret TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_created_at ON webhooks(created_at);
```

### Naming Conventions

- Tables: `snake_case`, plural (e.g., `webhook_configs`)
- Columns: `snake_case` (e.g., `created_at`)
- Indexes: `idx_{table}_{columns}` (e.g., `idx_webhooks_user_id`)
- Foreign keys: `{table}_{column}_fkey` (e.g., `webhooks_user_id_fkey`)

---

## 6. Testing Strategy

### Test Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import cloudflare from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  test: {
    pool: 'cloudflare',
    poolOptions: {
      cloudflare: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    },
  },
});
```

### Test Taxonomy

| Type | Scope | Characteristics |
|------|-------|------------------|
| **Unit** | Single function/module | Mock all dependencies, fast (<50ms) |
| **Functional** | Multiple units | Test a feature, minimal mocks |
| **Integration** | Full stack | Real DB, real external services where possible |

### File Naming

```typescript
// All test files use *.test.ts
src/
├── lib/
│   ├── validator.test.ts      // Unit tests for validator
│   └── parser.test.ts         // Unit tests for parser
├── routes/
│   ├── webhooks.test.ts       // Functional tests routes for webhook
│   └── auth.test.ts           // Functional tests for auth routes
└── services/
    └── webhook-service.test.ts // Integration tests
```

### Test Structure

```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createWebhook, getWebhooks } from './webhook-service';
import { db } from './db';

describe('webhook-service', () => {
  describe('createWebhook', () => {
    it('should create a webhook with valid input', async () => {
      const input = {
        url: 'https://example.com/webhook',
        events: ['webhook.created'],
        userId: 'user-123',
      };

      const result = await createWebhook(input);

      expect(result.ok).toBe(true);
      expect(result.data).toMatchObject({
        url: input.url,
        events: input.events,
        isActive: true,
      });
    });

    it('should reject invalid URLs', async () => {
      const input = {
        url: 'not-a-url',
        events: ['webhook.created'],
        userId: 'user-123',
      };

      const result = await createWebhook(input);

      expect(result.ok).toBe(false);
      expect(result.error.message).toContain('url');
    });
  });
});
```

### Coverage Requirements

- **Target: 100% coverage** for business logic
- Integration tests count toward coverage
- Report in CI via `--coverage` flag

---

## 7. Config-Driven Architecture

### Tier/Feature Configuration

```typescript
// packages/config/src/tiers.ts
import { z } from 'zod';

export const TierSchema = z.object({
  name: z.string(),
  maxWebhooks: z.number(), // -1 for unlimited
  maxRetries: z.number(),
  features: z.object({
    customDomains: z.boolean(),
    secretRotation: z.boolean(),
    analytics: z.boolean(),
    prioritySupport: z.boolean(),
  }),
});

export const ConfigSchema = z.object({
  tiers: z.record(TierSchema),
  defaults: TierSchema.partial(),
  regions: z.array(z.string()),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Tier = z.infer<typeof TierSchema>;

// Default config (can be overridden by environment)
export const defaultConfig: Config = {
  tiers: {
    free: {
      name: 'Free',
      maxWebhooks: 5,
      maxRetries: 3,
      features: {
        customDomains: false,
        secretRotation: false,
        analytics: false,
        prioritySupport: false,
      },
    },
    pro: {
      name: 'Pro',
      maxWebhooks: 50,
      maxRetries: 5,
      features: {
        customDomains: true,
        secretRotation: true,
        analytics: true,
        prioritySupport: false,
      },
    },
    enterprise: {
      name: 'Enterprise',
      maxWebhooks: -1,
      maxRetries: 10,
      features: {
        customDomains: true,
        secretRotation: true,
        analytics: true,
        prioritySupport: true,
      },
    },
  },
  defaults: {
    maxRetries: 3,
  },
  regions: ['us-east-1', 'eu-west-1', 'ap-south-1'],
};
```

### Feature Flags

```typescript
// packages/config/src/features.ts
import { z } from 'zod';

export const FeatureFlagSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  rolloutPercent: z.number().min(0).max(100).default(0),
  conditions: z.array(z.object({
    userId: z.string().optional(),
    tier: z.enum(['free', 'pro', 'enterprise']).optional(),
    region: z.string().optional(),
  })).optional(),
});

export const FeatureFlagsSchema = z.record(FeatureFlagSchema);
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
```

---

## 8. Security

### Secrets Management

**NEVER commit secrets to code.**

```typescript
// BAD: hardcoded secret
const API_KEY = 'sk-1234567890abcdef';

// GOOD: from environment/bindings
const apiKey = env.API_KEY;

// In wrangler.toml, use secrets:
// wrangler secret put API_KEY
```

### Environment Variables

```typescript
// src/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string(),           // D1 database binding
  AUTH_SECRET: z.string().min(32),    // Lucia auth secret
  ENCRYPTION_KEY: z.string().min(32), // AES-256 key
  STRIPE_SECRET_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export function getEnv(c: Context): z.infer<typeof EnvSchema> {
  const result = EnvSchema.safeParse(c.env);
  if (!result.success) {
    throw new Error(`Invalid environment: ${result.error.flatten().toString()}`);
  }
  return result.data;
}
```

### Input Validation

```typescript
// Validate ALL user input
const InputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().max(100).optional(),
});

// Sanitize HTML to prevent XSS
import { sanitize } from 'isomorphic-dompurify';

const userInput = sanitize(rawUserInput);
```

### CORS Configuration

```typescript
app.use('*', cors({
  origin: (origin) => {
    const allowed = ['https://hookwing.com', 'https://app.hookwing.com'];
    return allowed.includes(origin) ? origin : allowed[0];
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));
```

### Rate Limiting

```typescript
import { rateLimit } from '@upstash/ratelimit';

const ratelimit = new RateLimit({
  redis: Redis.fromEnv(),
  limiter: RateLimit.slidingWindow(100, '1m'),
});

app.use('*', async (c, next) => {
  const identifier = c.req.header('CF-Connecting-IP') || 'unknown';
  const result = await ratelimit.limit(identifier);

  if (!result.success) {
    return c.json({ error: 'Too many requests' }, 429);
  }

  c.set('rateLimitRemaining', result.remaining);
  await next();
});
```

### Authentication

Use **Lucia Auth** with **Argon2id** for password hashing:

```typescript
import { Lucia } from 'lucia';
import { DrizzleSQLiteAdapter } from '@lucia-auth/drizzle-adapter';
import { argon2id } from '@hashnode/argon2';

const adapter = new DrizzleSQLiteAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: { secure: process.env.NODE_ENV === 'production' },
  },
  getUserAttributes: (attributes) => ({
    email: attributes.email,
    tier: attributes.tier,
  }),
});

// Password hashing
async function hashPassword(password: string): Promise<string> {
  return await argon2id.hash(password, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await argon2id.verify(hash, password);
}
```

---

## 9. CI/CD

### GitHub Actions Pipeline

```yaml
name: CI

on:
  push:
    branches: [main, 'feature/**']
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

Examples:
```
feat(webhooks): add retry configuration per webhook
fix(api): resolve CORS preflight failure for credentials
docs: update API authentication guide
test: add integration tests for webhook delivery
ci: add deployment to staging environment
```

### Merge Strategy

- **Squash merge** all PRs
- Commit message = PR title + description
- Delete branch after merge

---

## 10. Code Review Checklist

### Security
- [ ] No secrets/API keys in code
- [ ] All user input validated with Zod schemas
- [ ] SQL queries use parameterized statements or ORM
- [ ] Authentication/authorization checks present
- [ ] Rate limiting implemented for public endpoints
- [ ] CORS properly configured

### Code Quality
- [ ] TypeScript strict mode, no `any` types
- [ ] Error handling with Result types
- [ ] Logging for important operations
- [ ] No TODO/FIXME comments (create issues instead)
- [ ] No console.log in production code

### Testing
- [ ] Unit tests for new functions
- [ ] Integration tests for new routes/services
- [ ] Test coverage maintained or improved
- [ ] Tests use realistic data, not just happy path

### Architecture
- [ ] Config-driven for tier/feature changes
- [ ] Shared code in packages/ when used across packages
- [ ] No duplicate code between packages
- [ ] Environment variables for configuration

### Review
- [ ] PR description explains *why*, not just *what*
- [ ] Related issues linked
- [ ] Breaking changes documented
- [ ] Migration scripts included if needed

---

## 11. Cloudflare Workers Patterns

### Bindings

```typescript
// src/env.ts
export interface Env {
  DB: D1Database;
  QUEUE: Queue;
  KV: KVNamespace;
  REDIS: Redis;
  AUTH_SECRET: string;
  ENCRYPTION_KEY: string;
  STRIPE_SECRET_KEY: string;
}
```

### Environment Typing

```typescript
// Extend Hono's context type
declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    requestId: string;
  }
}

// Use in handlers
app.get('/webhooks', (c) => {
  const user = c.get('user'); // Fully typed
  const requestId = c.get('requestId');
});
```

### Wrangler.toml Conventions

```toml
name = "hookwing-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
node_compat = true

[vars]
ENV = "development"

[[d1_databases]]
binding = "DB"
database_name = "hookwing-db"
database_id = "xxx-xxx-xxx"

[[queues]]
binding = "QUEUE"
consumer_batch_size = 10
consumer_timeout = 30

[[kv_namespaces]]
binding = "KV"
id = "xxx-xxx-xxx"
```

### Queue Workers

```typescript
import { Queue, QueueMessage } from './types';

export interface WebhookDeliveryMessage {
  webhookId: string;
  eventId: string;
  payload: string;
  attempt: number;
}

export default {
  async queue(batch: MessageBatch<WebhookDeliveryMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await deliverWebhook(message.body, env);
        await message.ack();
      } catch (error) {
        if (message.body.attempt >= MAX_RETRIES) {
          await moveToDeadLetter(message.body, env);
          await message.ack();
        } else {
          await message.retry();
        }
      }
    }
  },
};
```

---

## 12. Git Conventions

### Branch Naming

```
feature/PROD-XXX-description
fix/PROD-XXX-description
chore/PROD-XXX-description
```

Examples:
- `feature/PROD-77-engineering-standards`
- `fix/PROD-42-webhook-timeout`
- `chore/PROD-100-update-deps`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(webhooks): add batch delivery support
fix(api): resolve 500 error on empty webhook list
docs: update API authentication section
test: add webhook delivery integration tests
refactor(db): extract query builder to shared package
ci: add staging deployment workflow
```

### Pull Request Template

```markdown
## Summary
<!-- What does this PR do? -->

## Changes
<!-- Detailed list of changes -->

## Test Plan
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Migration scripts included (if DB changes)

## Related Issues
Closes #XXX
```

### Release Process

1. All PRs squash-merged to main
2. GitHub release created with conventional-commits parsed changelog
3. Version bumped via GitHub tag (follows semantic versioning)

---

## Quick Reference

| Category | Convention |
|----------|------------|
| Files | `kebab-case.ts` |
| Types | `PascalCase` |
| Variables | `camelCase` |
| Constants | `UPPER_SNAKE` |
| DB Tables | `snake_case` |
| Commits | `type(scope): description` |
| Branches | `feature/PROD-XXX-description` |
| Tests | `*.test.ts` |
| Config | Zod schemas, no hardcoded tiers |
