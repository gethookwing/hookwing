import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import otelRoutes from '../routes/otel';

describe('OTel Settings Routes', () => {
  // ========================================================================
  // GET /v1/otel/settings
  // ========================================================================

  describe('GET /v1/otel/settings', () => {
    it('should return 401 without auth', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings');
      expect(res.status).toBe(401);
    });

    it('should return 401 with empty Authorization header', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', {
        headers: { Authorization: '' },
      });
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid Bearer token (too short)', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', {
        headers: { Authorization: 'Bearer short' },
      });
      expect(res.status).toBe(401);
    });

    it('should return 401 without Bearer prefix', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', {
        headers: { Authorization: 'hk_live_abc123def456' },
      });
      expect(res.status).toBe(401);
    });

    it('should confirm route exists (not 404)', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings');
      expect(res.status).not.toBe(404);
    });

    it('should return JSON error response', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings');
      const json = await res.json();
      expect(json).toHaveProperty('error');
    });
  });

  // ========================================================================
  // PUT /v1/otel/settings
  // ========================================================================

  describe('PUT /v1/otel/settings', () => {
    it('should return 401 without auth', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otlpEndpoint: 'https://otel.example.com' }),
      });
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer too_short',
        },
        body: JSON.stringify({ otlpEndpoint: 'https://otel.example.com' }),
      });
      expect(res.status).toBe(401);
    });

    it('should confirm route exists (not 404)', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', {
        method: 'PUT',
        body: JSON.stringify({ otlpEndpoint: 'https://otel.example.com' }),
      });
      expect(res.status).not.toBe(404);
    });

    it('should return JSON error on auth failure', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', {
        method: 'PUT',
        body: JSON.stringify({ otlpEndpoint: 'https://otel.example.com' }),
      });
      const json = await res.json();
      expect(json).toHaveProperty('error');
    });
  });

  // ========================================================================
  // DELETE /v1/otel/settings
  // ========================================================================

  describe('DELETE /v1/otel/settings', () => {
    it('should return 401 without auth', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', { method: 'DELETE' });
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer bad' },
      });
      expect(res.status).toBe(401);
    });

    it('should confirm route exists (not 404)', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', { method: 'DELETE' });
      expect(res.status).not.toBe(404);
    });

    it('should return JSON error body', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', { method: 'DELETE' });
      const json = await res.json();
      expect(json).toHaveProperty('error');
      expect(json).toHaveProperty('message');
    });
  });

  // ========================================================================
  // Route mounting and method coverage
  // ========================================================================

  describe('Route structure', () => {
    it('should handle GET method', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', { method: 'GET' });
      expect(res.status).toBe(401);
    });

    it('should handle PUT method', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', { method: 'PUT' });
      expect(res.status).toBe(401);
    });

    it('should handle DELETE method', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', { method: 'DELETE' });
      expect(res.status).toBe(401);
    });

    it('should return 401 for POST (unsupported method but auth first)', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings', { method: 'POST' });
      // POST is not defined, so it should be 401 (auth middleware runs first) or 404/405
      expect([401, 404, 405]).toContain(res.status);
    });

    it('should return error response with expected fields', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings');
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('Unauthorized');
    });
  });

  // ========================================================================
  // Tier gating (paper-plane should be rejected)
  // Since auth middleware blocks first, we can't directly test tier gating
  // in unit tests. But we verify the route behavior.
  // ========================================================================

  describe('Tier gating', () => {
    it('should block unauthenticated requests before tier check', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const res = await app.request('/v1/otel/settings');
      // Auth middleware runs before tier check — returns 401
      expect(res.status).toBe(401);
    });

    it('should block all methods for unauthenticated users', async () => {
      const app = new Hono().route('/v1/otel', otelRoutes);
      const methods = ['GET', 'PUT', 'DELETE'] as const;
      for (const method of methods) {
        const res = await app.request('/v1/otel/settings', { method });
        expect(res.status).toBe(401);
      }
    });
  });
});
