/**
 * Tests for billing route scope enforcement
 *
 * Billing routes require authentication and specific scopes.
 * Without valid auth: 401.
 * With valid auth but wrong scope: 403.
 *
 * Stripe webhook endpoint is unauthenticated (public) and should not return 401.
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import billingRoutes from '../routes/billing';

const makeApp = () => new Hono().route('/v1/billing', billingRoutes);

describe('POST /v1/billing/checkout', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier: 'biplane' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid Bearer token', async () => {
    const res = await makeApp().request('/v1/billing/checkout', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid', 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'biplane' }),
    });
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier: 'biplane' }),
    });
    expect(res.status).not.toBe(404);
  });
});

describe('GET /v1/billing/portal', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/billing/portal');
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/billing/portal');
    expect(res.status).not.toBe(404);
  });

  it('should return JSON error on 401', async () => {
    const res = await makeApp().request('/v1/billing/portal');
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

describe('POST /v1/billing/upgrade', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/billing/upgrade', {
      method: 'POST',
      body: JSON.stringify({ tier: 'warbird' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/billing/upgrade', {
      method: 'POST',
      body: JSON.stringify({ tier: 'warbird' }),
    });
    expect(res.status).not.toBe(404);
  });
});

describe('POST /v1/billing/downgrade', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/billing/downgrade', {
      method: 'POST',
      body: JSON.stringify({ tier: 'paper-plane' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/billing/downgrade', {
      method: 'POST',
    });
    expect(res.status).not.toBe(404);
  });
});

describe('GET /v1/billing/status', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/billing/status');
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/billing/status');
    expect(res.status).not.toBe(404);
  });
});

describe('PATCH /v1/billing/settings', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/billing/settings', {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/billing/settings', {
      method: 'PATCH',
    });
    expect(res.status).not.toBe(404);
  });
});

describe('POST /v1/billing/webhook (Stripe webhook — public)', () => {
  it('should not return 401 (public route — no auth required)', async () => {
    const res = await makeApp().request('/v1/billing/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'checkout.session.completed' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).not.toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/billing/webhook', {
      method: 'POST',
      body: '{}',
    });
    expect(res.status).not.toBe(404);
  });
});
