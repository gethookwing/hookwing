import { describe, expect, it } from 'vitest';
import { app } from '../index';

interface StatusResponse {
  status: string;
  version: string;
  timestamp: string;
  services: { api: string; db: string };
}

interface PricingResponse {
  tiers: Array<{
    name: string;
    slug: string;
    price: number;
    features: object;
    limits: object;
  }>;
  currency: string;
  billingPeriod: string;
}

interface OpenAPIResponse {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, unknown>;
}

describe('GET /openapi.json', () => {
  it('should return 200 with valid OpenAPI spec as JSON', async () => {
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const body = (await res.json()) as OpenAPIResponse;
    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toBe('Hookwing Webhook API');
    expect(body.info.version).toBe('1.0.0');
  });

  it('should include all major path groups', async () => {
    const res = await app.request('/openapi.json');
    const body = (await res.json()) as OpenAPIResponse;

    const paths = Object.keys(body.paths);
    expect(paths.some((p) => p.includes('/health'))).toBe(true);
    expect(paths.some((p) => p.includes('/tiers'))).toBe(true);
    expect(paths.some((p) => p.includes('/auth'))).toBe(true);
    expect(paths.some((p) => p.includes('/endpoints'))).toBe(true);
  });
});

describe('GET /api/pricing', () => {
  it('should return 200 with tier metadata', async () => {
    const res = await app.request('/api/pricing');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const body = (await res.json()) as PricingResponse;
    expect(body.tiers).toBeDefined();
    expect(body.tiers.length).toBeGreaterThan(0);
    expect(body.currency).toBe('USD');
    expect(body.billingPeriod).toBe('monthly');
  });

  it('should include all tiers with required fields', async () => {
    const res = await app.request('/api/pricing');
    const body = (await res.json()) as PricingResponse;

    const tierSlugs = body.tiers.map((t) => t.slug);
    expect(tierSlugs).toContain('paper-plane');
    expect(tierSlugs).toContain('warbird');
    expect(tierSlugs).toContain('stealth-jet');

    // Each tier should have required fields
    for (const tier of body.tiers) {
      expect(tier.name).toBeDefined();
      expect(tier.slug).toBeDefined();
      expect(tier.price).toBeDefined();
      expect(tier.features).toBeDefined();
      expect(tier.limits).toBeDefined();
    }
  });

  it('should return correct pricing values', async () => {
    const res = await app.request('/api/pricing');
    const body = (await res.json()) as PricingResponse;

    const paperPlane = body.tiers.find((t) => t.slug === 'paper-plane');
    expect(paperPlane?.price).toBe(0);

    const warbird = body.tiers.find((t) => t.slug === 'warbird');
    expect(warbird?.price).toBe(19);

    const fighterJet = body.tiers.find((t) => t.slug === 'stealth-jet');
    expect(fighterJet?.price).toBe(89);
  });
});

describe('GET /api/status', () => {
  it('should return 200 with operational status', async () => {
    const res = await app.request('/api/status');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const body = (await res.json()) as StatusResponse;
    expect(body.status).toBe('operational');
    expect(body.version).toBe('1.0.0');
  });

  it('should include timestamp in ISO format', async () => {
    const res = await app.request('/api/status');
    const body = (await res.json()) as StatusResponse;

    expect(body.timestamp).toBeDefined();
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('should include services object with api and db status', async () => {
    const res = await app.request('/api/status');
    const body = (await res.json()) as StatusResponse;

    expect(body.services).toBeDefined();
    expect(body.services.api).toBe('ok');
    // DB status depends on env - either 'ok', 'error', or 'not configured'
    expect(['ok', 'error', 'not configured']).toContain(body.services.db);
  });
});

describe('public endpoints are unauthenticated', () => {
  it('/openapi.json does not require auth', async () => {
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
  });

  it('/api/pricing does not require auth', async () => {
    const res = await app.request('/api/pricing');
    expect(res.status).toBe(200);
  });

  it('/api/status does not require auth', async () => {
    const res = await app.request('/api/status');
    expect(res.status).toBe(200);
  });
});
