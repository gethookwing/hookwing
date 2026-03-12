import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import eventRoutes from '../routes/events';

const makeApp = () => new Hono().route('/v1/events', eventRoutes);

describe('GET /v1/events', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/events');
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid auth header', async () => {
    const res = await makeApp().request('/v1/events', {
      headers: { Authorization: 'Bearer invalid' },
    });
    expect(res.status).toBe(401);
  });

  it('should return JSON error on 401', async () => {
    const res = await makeApp().request('/v1/events');
    const body = (await res.json()) as { error: string };
    expect(body).toHaveProperty('error');
  });

  it('should confirm route is mounted (not 404)', async () => {
    const res = await makeApp().request('/v1/events');
    expect(res.status).not.toBe(404);
  });
});

describe('GET /v1/events/:id', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/events/evt_test123');
    expect(res.status).toBe(401);
  });

  it('should confirm route is mounted', async () => {
    const res = await makeApp().request('/v1/events/evt_test123');
    expect(res.status).not.toBe(404);
  });
});

describe('GET /v1/events/:id/deliveries', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/events/evt_test123/deliveries');
    expect(res.status).toBe(401);
  });

  it('should confirm route is mounted', async () => {
    const res = await makeApp().request('/v1/events/evt_test123/deliveries');
    expect(res.status).not.toBe(404);
  });
});

describe('POST /v1/events/:id/replay', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/events/evt_test123/replay', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('should confirm route is mounted', async () => {
    const res = await makeApp().request('/v1/events/evt_test123/replay', {
      method: 'POST',
    });
    expect(res.status).not.toBe(404);
  });
});

describe('POST /v1/events/replay', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/events/replay', {
      method: 'POST',
      body: JSON.stringify({ eventIds: ['evt_1'] }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('should confirm route is mounted', async () => {
    const res = await makeApp().request('/v1/events/replay', {
      method: 'POST',
      body: JSON.stringify({ eventIds: ['evt_1'] }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).not.toBe(404);
  });
});
