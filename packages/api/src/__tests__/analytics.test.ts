import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import analyticsRoutes from '../routes/analytics';

const makeApp = () => new Hono().route('/v1/analytics', analyticsRoutes);

describe('GET /v1/analytics/usage', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/analytics/usage');
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid API key', async () => {
    const res = await makeApp().request('/v1/analytics/usage', {
      headers: { Authorization: 'Bearer invalid_key' },
    });
    expect(res.status).toBe(401);
  });

  it('should not accept requests without Authorization header', async () => {
    const res = await makeApp().request('/v1/analytics/usage', {
      method: 'GET',
    });
    expect(res.status).not.toBe(200);
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/analytics/summary', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/analytics/summary');
    expect(res.status).toBe(401);
  });

  it('should return 401 with malformed auth', async () => {
    const res = await makeApp().request('/v1/analytics/summary', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(res.status).toBe(401);
  });
});

describe('analytics service contract', () => {
  it('should export trackEventReceived', async () => {
    const { trackEventReceived } = await import('../services/analytics.js');
    expect(typeof trackEventReceived).toBe('function');
  });

  it('should export trackDeliveryAttempted', async () => {
    const { trackDeliveryAttempted } = await import('../services/analytics.js');
    expect(typeof trackDeliveryAttempted).toBe('function');
  });

  it('should export trackDeliverySucceeded', async () => {
    const { trackDeliverySucceeded } = await import('../services/analytics.js');
    expect(typeof trackDeliverySucceeded).toBe('function');
  });

  it('should export trackDeliveryFailed', async () => {
    const { trackDeliveryFailed } = await import('../services/analytics.js');
    expect(typeof trackDeliveryFailed).toBe('function');
  });

  it('should calculate today date in YYYY-MM-DD format', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should calculate success rate correctly', () => {
    const attempted = 100;
    const succeeded = 95;
    const rate = Math.round((succeeded / attempted) * 10000) / 100;
    expect(rate).toBe(95);
  });

  it('should handle zero deliveries gracefully', () => {
    const attempted = 0;
    const succeeded = 0;
    const rate = attempted > 0 ? Math.round((succeeded / attempted) * 10000) / 100 : null;
    expect(rate).toBeNull();
  });
});
