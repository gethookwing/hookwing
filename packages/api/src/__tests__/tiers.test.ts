import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { app } from '../index';
import { checkTierFeature } from '../middleware/tier';

describe('GET /tiers', () => {
  it('should return 200 with array of 3 tiers', async () => {
    const res = await app.request('/tiers');
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(3);
  });

  it('should include all 3 tier slugs', async () => {
    const res = await app.request('/tiers');
    const body = (await res.json()) as Array<{ slug: string }>;
    const slugs = body.map((t) => t.slug);
    expect(slugs).toContain('free');
    expect(slugs).toContain('pro');
    expect(slugs).toContain('enterprise');
  });

  it('should NOT include removed tiers', async () => {
    const res = await app.request('/tiers');
    const body = (await res.json()) as Array<{ slug: string }>;
    const slugs = body.map((t) => t.slug);
    expect(slugs).not.toContain('biplane');
    expect(slugs).not.toContain('jet');
  });
});

describe('GET /tiers/:slug', () => {
  it('should return 200 with tier config for valid slug', async () => {
    const res = await app.request('/tiers/free');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { slug: string; name: string };
    expect(body.slug).toBe('free');
    expect(body.name).toBe('Free');
  });

  it('should return 200 for each valid tier slug', async () => {
    for (const slug of ['free', 'pro', 'enterprise']) {
      const res = await app.request(`/tiers/${slug}`);
      expect(res.status).toBe(200);
    }
  });

  it('should return 404 for removed tier slugs', async () => {
    for (const slug of ['biplane', 'jet']) {
      const res = await app.request(`/tiers/${slug}`);
      expect(res.status).toBe(404);
    }
  });

  it('should return 404 for unknown slug', async () => {
    const res = await app.request('/tiers/unknown-tier');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string; slug: string };
    expect(body.error).toBe('Tier not found');
    expect(body.slug).toBe('unknown-tier');
  });
});

describe('checkTierFeature middleware', () => {
  it('should block access (403) to features not on free', async () => {
    const testApp = new Hono();
    testApp.get('/protected', checkTierFeature('custom_headers'), (c) => c.json({ ok: true }));

    const res = await testApp.request('/protected');
    expect(res.status).toBe(403);
    const body = (await res.json()) as {
      error: string;
      tier: string;
      feature: string;
    };
    expect(body.error).toBe('Feature not available on your tier');
    expect(body.tier).toBe('free');
    expect(body.feature).toBe('custom_headers');
  });

  it('should allow access to unguarded endpoints', async () => {
    const testApp = new Hono();
    testApp.get('/open', (c) => c.json({ ok: true }));
    const res = await testApp.request('/open');
    expect(res.status).toBe(200);
  });

  it('should block ip_whitelist on free', async () => {
    const testApp = new Hono();
    testApp.get('/guarded', checkTierFeature('ip_whitelist'), (c) => c.json({ ok: true }));
    const res = await testApp.request('/guarded');
    expect(res.status).toBe(403);
  });

  it('should block dead_letter_queue on free', async () => {
    const testApp = new Hono();
    testApp.get('/guarded', checkTierFeature('dead_letter_queue'), (c) => c.json({ ok: true }));
    const res = await testApp.request('/guarded');
    expect(res.status).toBe(403);
  });
});
