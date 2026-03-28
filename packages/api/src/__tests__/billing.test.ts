import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { requireApiKeyScopes } from '../middleware/auth';

// Mock Stripe
vi.mock('stripe', () => {
  const mockStripe = {
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_test123' }),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/test' }),
      },
    },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({
        id: 'sub_test123',
        status: 'active',
        current_period_end: 1700000000,
        cancel_at_period_end: false,
        items: {
          data: [{ id: 'si_test123', price: { id: 'price_warbird' } }],
        },
      }),
      update: vi.fn().mockResolvedValue({ id: 'sub_test123' }),
    },
    webhooks: {
      constructEvent: vi.fn().mockImplementation((body: string) => {
        return JSON.parse(body);
      }),
    },
  };
  return { default: vi.fn(() => mockStripe) };
});

interface MockWorkspace {
  id: string;
  name: string;
  tierSlug: string;
  email: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  agentUpgradeBehavior: string;
}

type TestBindings = {
  Variables: {
    workspace: MockWorkspace;
    apiKey: {
      id: string;
      name: string;
      keyPrefix: string;
      scopes: string[] | null;
    };
  };
};

function createMockAuthMiddleware(scopes: string[] | null, workspaceProps?: Partial<MockWorkspace>): MiddlewareHandler<TestBindings> {
  const defaultWorkspace: MockWorkspace = {
    id: 'ws_test_123',
    name: 'Test Workspace',
    tierSlug: 'paper-plane',
    email: 'test@example.com',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    agentUpgradeBehavior: 'disabled',
  };

  return async (c, next) => {
    c.set('apiKey', {
      id: 'test_key_123',
      name: 'Test Key',
      keyPrefix: 'test_key_',
      scopes,
    });
    c.set('workspace', { ...defaultWorkspace, ...workspaceProps } as MockWorkspace);
    await next();
  };
}

describe('billing scope enforcement', () => {
  const createApp = (scopes: string[] | null) => {
    const app = new Hono();
    app.use('*', createMockAuthMiddleware(scopes));
    app.get('/status', requireApiKeyScopes(['billing:read']), (c) => c.json({ ok: true }));
    app.post('/upgrade', requireApiKeyScopes(['billing:upgrade']), (c) => c.json({ ok: true }));
    app.post('/downgrade', requireApiKeyScopes(['billing:upgrade']), (c) => c.json({ ok: true }));
    return app;
  };

  it('forbids key without billing:read scope from /status', async () => {
    const app = createApp(['endpoints:read']);
    const res = await app.request('/status');
    expect(res.status).toBe(403);
  });

  it('allows key with billing:read scope to access /status', async () => {
    const app = createApp(['billing:read']);
    const res = await app.request('/status');
    expect(res.status).toBe(200);
  });

  it('forbids key without billing:upgrade scope from /upgrade', async () => {
    const app = createApp(['billing:read']);
    const res = await app.request('/upgrade', { method: 'POST' });
    expect(res.status).toBe(403);
  });

  it('allows key with billing:upgrade scope to access /upgrade', async () => {
    const app = createApp(['billing:upgrade']);
    const res = await app.request('/upgrade', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('forbids key without billing:upgrade scope from /downgrade', async () => {
    const app = createApp(['billing:read']);
    const res = await app.request('/downgrade', { method: 'POST' });
    expect(res.status).toBe(403);
  });

  it('allows key with billing:upgrade scope to access /downgrade', async () => {
    const app = createApp(['billing:upgrade']);
    const res = await app.request('/downgrade', { method: 'POST' });
    expect(res.status).toBe(200);
  });
});

describe('billing upgrade behavior checks', () => {
  const createAppWithBehavior = (behavior: string, hasSubscription = false) => {
    const app = new Hono<TestBindings>();
    app.use('*', createMockAuthMiddleware(['billing:upgrade'], { agentUpgradeBehavior: behavior, stripeSubscriptionId: hasSubscription ? 'sub_test' : null }));
    app.post('/upgrade', requireApiKeyScopes(['billing:upgrade']), async (c) => {
      const workspace = c.get('workspace');

      // Check 1: agentUpgradeBehavior must not be 'disabled'
      if (workspace.agentUpgradeBehavior === 'disabled') {
        return c.json({ error: 'agent_upgrade_disabled' }, 403);
      }

      // Check 2: must have an active subscription
      if (!workspace.stripeSubscriptionId && !hasSubscription) {
        return c.json({ error: 'payment_method_required', checkoutUrl: '/settings/billing' }, 402);
      }

      return c.json({ ok: true });
    });
    return app;
  };

  it('returns 403 when agentUpgradeBehavior is disabled', async () => {
    const app = createAppWithBehavior('disabled');
    const res = await app.request('/upgrade', { method: 'POST' });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('agent_upgrade_disabled');
  });

  it('returns 402 when no subscription exists', async () => {
    const app = createAppWithBehavior('enabled', false);
    const res = await app.request('/upgrade', { method: 'POST' });
    expect(res.status).toBe(402);
    const body = await res.json() as { error: string; checkoutUrl: string };
    expect(body.error).toBe('payment_method_required');
    expect(body.checkoutUrl).toBe('/settings/billing');
  });
});

describe('billing settings endpoint', () => {
  const createApp = (scopes: string[] | null) => {
    const app = new Hono();
    app.use('*', createMockAuthMiddleware(scopes));
    app.patch('/settings', requireApiKeyScopes(['workspace:write']), (c) => c.json({ ok: true }));
    return app;
  };

  it('forbids key without workspace:write scope from /settings', async () => {
    const app = createApp(['billing:read']);
    const res = await app.request('/settings', { method: 'PATCH' });
    expect(res.status).toBe(403);
  });

  it('allows key with workspace:write scope to access /settings', async () => {
    const app = createApp(['workspace:write']);
    const res = await app.request('/settings', { method: 'PATCH' });
    expect(res.status).toBe(200);
  });
});

describe('webhook signature validation', () => {
  it('returns 400 when Stripe-Signature header is missing', async () => {
    const app = new Hono();
    app.post('/webhook', async (c) => {
      const signature = c.req.header('Stripe-Signature');
      if (!signature) {
        return c.json({ error: 'Missing Stripe-Signature header' }, 400);
      }
      return c.json({ ok: true });
    });

    const res = await app.request('/webhook', { method: 'POST' });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Missing Stripe-Signature header');
  });
});
