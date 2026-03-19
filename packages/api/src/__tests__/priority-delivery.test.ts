import { DEFAULT_TIERS, getTierBySlug, isFeatureEnabled } from '@hookwing/shared';
import { describe, expect, it } from 'vitest';

describe('priority_delivery feature', () => {
  it('should be disabled for paper-plane tier', () => {
    const tier = getTierBySlug('paper-plane');
    expect(tier).toBeDefined();
    if (tier) {
      expect(isFeatureEnabled(tier, 'priority_delivery')).toBe(false);
    }
  });

  it('should be enabled for warbird tier', () => {
    const tier = getTierBySlug('warbird');
    expect(tier).toBeDefined();
    if (tier) {
      expect(isFeatureEnabled(tier, 'priority_delivery')).toBe(true);
    }
  });

  it('should be enabled for fighter-jet tier', () => {
    const tier = getTierBySlug('fighter-jet');
    expect(tier).toBeDefined();
    if (tier) {
      expect(isFeatureEnabled(tier, 'priority_delivery')).toBe(true);
    }
  });

  it('should have all three tiers defined', () => {
    expect(DEFAULT_TIERS).toHaveLength(3);
  });
});

describe('priority calculation', () => {
  it('should return priority 0 for paper-plane tier', () => {
    const tier = getTierBySlug('paper-plane');
    const priority = tier && isFeatureEnabled(tier, 'priority_delivery') ? 1 : 0;
    expect(priority).toBe(0);
  });

  it('should return priority 1 for warbird tier', () => {
    const tier = getTierBySlug('warbird');
    const priority = tier && isFeatureEnabled(tier, 'priority_delivery') ? 1 : 0;
    expect(priority).toBe(1);
  });

  it('should return priority 1 for fighter-jet tier', () => {
    const tier = getTierBySlug('fighter-jet');
    const priority = tier && isFeatureEnabled(tier, 'priority_delivery') ? 1 : 0;
    expect(priority).toBe(1);
  });
});

describe('queue message sorting by priority', () => {
  interface TestMessage {
    id: string;
    priority: number;
  }

  it('should sort messages with higher priority first', () => {
    const messages: TestMessage[] = [
      { id: 'a', priority: 0 },
      { id: 'b', priority: 1 },
      { id: 'c', priority: 0 },
      { id: 'd', priority: 1 },
    ];

    const sorted = [...messages].sort((a, b) => b.priority - a.priority);

    // Priority 1 items should come first (in any order among themselves)
    expect(sorted[0]!.priority).toBe(1);
    expect(sorted[1]!.priority).toBe(1);
    expect(sorted[2]!.priority).toBe(0);
    expect(sorted[3]!.priority).toBe(0);
  });

  it('should handle messages with undefined priority', () => {
    // Simulate the actual queue message handling where priority defaults to 0
    interface QueueMessage {
      body: { priority?: number };
    }
    const messages: QueueMessage[] = [
      { body: { priority: 0 } },
      { body: {} },
      { body: { priority: 1 } },
    ];

    const sorted = [...messages].sort((a, b) => (b.body.priority ?? 0) - (a.body.priority ?? 0));

    expect(sorted[0]!.body.priority).toBe(1);
    expect(sorted[1]!.body.priority ?? 0).toBe(0);
    expect(sorted[2]!.body.priority ?? 0).toBe(0);
  });

  it('should handle all same priority', () => {
    const messages = [
      { id: 'a', priority: 0 },
      { id: 'b', priority: 0 },
      { id: 'c', priority: 0 },
    ];

    const sorted = [...messages].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    expect(sorted).toHaveLength(3);
    expect(sorted.every((m) => m.priority === 0)).toBe(true);
  });
});
