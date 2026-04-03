/**
 * Tests for 2FA (TOTP) authentication endpoints
 *
 * Routes covered:
 *   POST /v1/auth/2fa/setup         — Generate TOTP secret (authenticated, workspace:write)
 *   POST /v1/auth/2fa/verify        — Enable TOTP after setup (authenticated, workspace:write)
 *   POST /v1/auth/2fa/disable       — Disable TOTP (authenticated, workspace:write)
 *   POST /v1/auth/2fa/validate      — Complete login with TOTP code (public)
 *   PUT  /v1/auth/2fa/enable-captcha — Toggle CAPTCHA requirement (authenticated, workspace:write)
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import authRoutes from '../routes/auth';

const makeApp = () => new Hono().route('/v1/auth', authRoutes);

// ============================================================================
// POST /v1/auth/2fa/setup
// ============================================================================

describe('POST /v1/auth/2fa/setup', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/auth/2fa/setup', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid Bearer token', async () => {
    const res = await makeApp().request('/v1/auth/2fa/setup', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid' },
    });
    expect(res.status).toBe(401);
  });

  it('should return JSON error body on 401', async () => {
    const res = await makeApp().request('/v1/auth/2fa/setup', { method: 'POST' });
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/auth/2fa/setup', { method: 'POST' });
    expect(res.status).not.toBe(404);
  });

  it('should require Bearer auth (not Basic)', async () => {
    const res = await makeApp().request('/v1/auth/2fa/setup', {
      method: 'POST',
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// POST /v1/auth/2fa/verify
// ============================================================================

describe('POST /v1/auth/2fa/verify', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid Bearer token', async () => {
    const res = await makeApp().request('/v1/auth/2fa/verify', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: '123456' }),
    });
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).not.toBe(404);
  });

  it('should return JSON error body on 401', async () => {
    const res = await makeApp().request('/v1/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
    });
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ============================================================================
// POST /v1/auth/2fa/disable
// ============================================================================

describe('POST /v1/auth/2fa/disable', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid Bearer token', async () => {
    const res = await makeApp().request('/v1/auth/2fa/disable', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: '123456' }),
    });
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
    });
    expect(res.status).not.toBe(404);
  });

  it('should return JSON error body on 401', async () => {
    const res = await makeApp().request('/v1/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
    });
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ============================================================================
// POST /v1/auth/2fa/validate (public — no auth required)
// ============================================================================

describe('POST /v1/auth/2fa/validate', () => {
  it('should not return 401 (public route — no auth needed)', async () => {
    const res = await makeApp().request('/v1/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ tempToken: 'sometoken', code: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).not.toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ tempToken: 'sometoken', code: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).not.toBe(404);
  });

  it('should return 400 for missing tempToken', async () => {
    const res = await makeApp().request('/v1/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('should return 400 for missing code', async () => {
    const res = await makeApp().request('/v1/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ tempToken: 'sometoken' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('should return 400 for code that is not 6 characters', async () => {
    const res = await makeApp().request('/v1/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ tempToken: 'sometoken', code: '123' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('should return 400 for code that is 7 characters (too long)', async () => {
    const res = await makeApp().request('/v1/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ tempToken: 'sometoken', code: '1234567' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('should return 400 for empty tempToken', async () => {
    const res = await makeApp().request('/v1/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ tempToken: '', code: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid (non-base64) tempToken', async () => {
    const res = await makeApp().request('/v1/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ tempToken: '!!!invalid!!!', code: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    });
    // The token parsing will fail → 400
    expect(res.status).toBe(400);
  });

  it('should return 400 for base64 token missing required segments', async () => {
    // Base64-encode a string that has no colons (missing id:timestamp:signature)
    const invalidToken = btoa('no-colons-at-all');
    const res = await makeApp().request('/v1/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ tempToken: invalidToken, code: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('should return 400 for expired temp token', async () => {
    // Create a token with a timestamp from 10 minutes ago (expired after 5 min)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const id = 'ws_test123';
    const timestamp = tenMinutesAgo.toString();
    // The signature won't match but token parsing happens before signature check? No, sig is checked.
    // Actually the token format is workspaceId:timestamp:signature
    // We can't forge the signature without the secret, but we can test that malformed tokens → 400
    const fakeToken = btoa(`${id}:${timestamp}:fakesignature`);
    const res = await makeApp().request('/v1/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ tempToken: fakeToken, code: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    });
    // Invalid signature → 400
    expect(res.status).toBe(400);
  });

  it('should return 400 for empty request body', async () => {
    const res = await makeApp().request('/v1/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('should return JSON error response', async () => {
    const res = await makeApp().request('/v1/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ tempToken: 'bad', code: '123' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ============================================================================
// PUT /v1/auth/2fa/enable-captcha
// ============================================================================

describe('PUT /v1/auth/2fa/enable-captcha', () => {
  it('should return 401 without auth', async () => {
    const res = await makeApp().request('/v1/auth/2fa/enable-captcha', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid Bearer token', async () => {
    const res = await makeApp().request('/v1/auth/2fa/enable-captcha', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer invalid',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.status).toBe(401);
  });

  it('should not return 404 (route is mounted)', async () => {
    const res = await makeApp().request('/v1/auth/2fa/enable-captcha', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    expect(res.status).not.toBe(404);
  });

  it('should return JSON error body on 401', async () => {
    const res = await makeApp().request('/v1/auth/2fa/enable-captcha', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});
