import { describe, expect, it } from 'vitest';
import { app } from '../index';

interface WebhookSource {
  id: string;
  name: string;
  description: string;
  docsUrl: string;
  icon: string;
  eventCategories: { name: string; eventTypes: string[] }[];
  eventTypes: string[];
  signature: { header: string; algorithm: string };
  recommendedEventTypes: string[];
  setupSteps: string[];
}

interface SourcesResponse {
  sources: WebhookSource[];
}

describe('GET /api/webhook-sources', () => {
  it('returns all webhook sources', async () => {
    const res = await app.request('/api/webhook-sources');
    expect(res.status).toBe(200);
    const body = (await res.json()) as SourcesResponse;
    expect(body.sources).toBeDefined();
    expect(Array.isArray(body.sources)).toBe(true);
    expect(body.sources.length).toBeGreaterThanOrEqual(4);
  });

  it('includes required fields for each source', async () => {
    const res = await app.request('/api/webhook-sources');
    const { sources } = (await res.json()) as SourcesResponse;
    for (const source of sources) {
      expect(source.id).toBeTruthy();
      expect(source.name).toBeTruthy();
      expect(source.description).toBeTruthy();
      expect(source.docsUrl).toBeTruthy();
      expect(source.icon).toBeTruthy();
      expect(Array.isArray(source.eventCategories)).toBe(true);
      expect(Array.isArray(source.eventTypes)).toBe(true);
      expect(source.eventTypes.length).toBeGreaterThan(0);
      expect(source.signature).toBeDefined();
      expect(source.signature.header).toBeTruthy();
      expect(source.signature.algorithm).toBeTruthy();
      expect(Array.isArray(source.recommendedEventTypes)).toBe(true);
      expect(Array.isArray(source.setupSteps)).toBe(true);
    }
  });

  it('includes Stripe, GitHub, Shopify, and Linear', async () => {
    const res = await app.request('/api/webhook-sources');
    const { sources } = (await res.json()) as SourcesResponse;
    const ids = sources.map((s: { id: string }) => s.id);
    expect(ids).toContain('stripe');
    expect(ids).toContain('github');
    expect(ids).toContain('shopify');
    expect(ids).toContain('linear');
  });

  it('has event categories with valid event types', async () => {
    const res = await app.request('/api/webhook-sources');
    const { sources } = (await res.json()) as SourcesResponse;
    for (const source of sources) {
      for (const category of source.eventCategories) {
        expect(category.name).toBeTruthy();
        expect(Array.isArray(category.eventTypes)).toBe(true);
        expect(category.eventTypes.length).toBeGreaterThan(0);
        // Every event in a category should be in the flat eventTypes list
        for (const eventType of category.eventTypes) {
          expect(source.eventTypes).toContain(eventType);
        }
      }
    }
  });

  it('recommended event types are subset of all event types', async () => {
    const res = await app.request('/api/webhook-sources');
    const { sources } = (await res.json()) as SourcesResponse;
    for (const source of sources) {
      for (const recommended of source.recommendedEventTypes) {
        expect(source.eventTypes).toContain(recommended);
      }
    }
  });
});

describe('GET /api/webhook-sources/:id', () => {
  it('returns a specific source by ID', async () => {
    const res = await app.request('/api/webhook-sources/stripe');
    expect(res.status).toBe(200);
    const source = (await res.json()) as WebhookSource;
    expect(source.id).toBe('stripe');
    expect(source.name).toBe('Stripe');
  });

  it('returns 404 for unknown source', async () => {
    const res = await app.request('/api/webhook-sources/unknown-provider');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Source not found');
  });

  it('returns GitHub source with correct signature header', async () => {
    const res = await app.request('/api/webhook-sources/github');
    expect(res.status).toBe(200);
    const source = (await res.json()) as WebhookSource;
    expect(source.signature.header).toBe('X-Hub-Signature-256');
    expect(source.signature.algorithm).toContain('SHA256');
  });

  it('returns Shopify source with correct signature header', async () => {
    const res = await app.request('/api/webhook-sources/shopify');
    expect(res.status).toBe(200);
    const source = (await res.json()) as WebhookSource;
    expect(source.signature.header).toBe('X-Shopify-Hmac-Sha256');
  });

  it('returns Linear source with correct signature header', async () => {
    const res = await app.request('/api/webhook-sources/linear');
    expect(res.status).toBe(200);
    const source = (await res.json()) as WebhookSource;
    expect(source.signature.header).toBe('Linear-Signature');
  });
});
