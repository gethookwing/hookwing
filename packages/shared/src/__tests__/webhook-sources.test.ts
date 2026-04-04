import { describe, expect, it } from 'vitest';
import { WEBHOOK_SOURCES, getWebhookSource, getWebhookSourceIds } from '../config/webhook-sources';

describe('WEBHOOK_SOURCES', () => {
  it('has at least 4 sources', () => {
    expect(WEBHOOK_SOURCES.length).toBeGreaterThanOrEqual(4);
  });

  it('all sources have unique IDs', () => {
    const ids = WEBHOOK_SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all sources have non-empty event types', () => {
    for (const source of WEBHOOK_SOURCES) {
      expect(source.eventTypes.length).toBeGreaterThan(0);
    }
  });

  it('all event categories are consistent with flat list', () => {
    for (const source of WEBHOOK_SOURCES) {
      const categoryEvents = source.eventCategories.flatMap((c) => c.eventTypes);
      // Every category event should be in the flat list
      for (const evt of categoryEvents) {
        expect(source.eventTypes).toContain(evt);
      }
    }
  });
});

describe('getWebhookSource', () => {
  it('returns source by ID', () => {
    const stripe = getWebhookSource('stripe');
    expect(stripe).toBeDefined();
    expect(stripe?.name).toBe('Stripe');
  });

  it('returns undefined for unknown ID', () => {
    expect(getWebhookSource('nonexistent')).toBeUndefined();
  });
});

describe('getWebhookSourceIds', () => {
  it('returns all source IDs', () => {
    const ids = getWebhookSourceIds();
    expect(ids).toContain('stripe');
    expect(ids).toContain('github');
    expect(ids).toContain('shopify');
    expect(ids).toContain('linear');
  });
});
