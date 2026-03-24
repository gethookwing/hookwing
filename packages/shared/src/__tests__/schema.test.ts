import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  events,
  type NewWorkspace,
  type Workspace,
  apiKeys,
  deliveries,
  endpoints,
  usageDaily,
  workspaces,
} from '../db/schema';

describe('schema exports', () => {
  it('should export all 6 tables', () => {
    expect(workspaces).toBeDefined();
    expect(apiKeys).toBeDefined();
    expect(endpoints).toBeDefined();
    expect(events).toBeDefined();
    expect(deliveries).toBeDefined();
    expect(usageDaily).toBeDefined();
  });
});

describe('table names (snake_case convention)', () => {
  it('should use correct snake_case table names', () => {
    expect(getTableName(workspaces)).toBe('workspaces');
    expect(getTableName(apiKeys)).toBe('api_keys');
    expect(getTableName(endpoints)).toBe('endpoints');
    expect(getTableName(events)).toBe('events');
    expect(getTableName(deliveries)).toBe('deliveries');
    expect(getTableName(usageDaily)).toBe('usage_daily');
  });
});

describe('workspaces columns', () => {
  it('should have expected column definitions', () => {
    expect(workspaces.id).toBeDefined();
    expect(workspaces.name).toBeDefined();
    expect(workspaces.slug).toBeDefined();
    expect(workspaces.tierSlug).toBeDefined();
    expect(workspaces.stripeCustomerId).toBeDefined();
    expect(workspaces.createdAt).toBeDefined();
    expect(workspaces.updatedAt).toBeDefined();
  });
});

describe('api_keys columns', () => {
  it('should have expected column definitions', () => {
    expect(apiKeys.id).toBeDefined();
    expect(apiKeys.workspaceId).toBeDefined();
    expect(apiKeys.keyHash).toBeDefined();
    expect(apiKeys.keyPrefix).toBeDefined();
    expect(apiKeys.isActive).toBeDefined();
    expect(apiKeys.createdAt).toBeDefined();
  });
});

describe('endpoints columns', () => {
  it('should have expected column definitions', () => {
    expect(endpoints.id).toBeDefined();
    expect(endpoints.workspaceId).toBeDefined();
    expect(endpoints.url).toBeDefined();
    expect(endpoints.secret).toBeDefined();
    expect(endpoints.isActive).toBeDefined();
  });
});

describe('events columns', () => {
  it('should have expected column definitions', () => {
    expect(events.id).toBeDefined();
    expect(events.workspaceId).toBeDefined();
    expect(events.eventType).toBeDefined();
    expect(events.payload).toBeDefined();
    expect(events.status).toBeDefined();
    expect(events.receivedAt).toBeDefined();
  });
});

describe('deliveries columns', () => {
  it('should have expected column definitions', () => {
    expect(deliveries.id).toBeDefined();
    expect(deliveries.eventId).toBeDefined();
    expect(deliveries.endpointId).toBeDefined();
    expect(deliveries.workspaceId).toBeDefined();
    expect(deliveries.attemptNumber).toBeDefined();
    expect(deliveries.status).toBeDefined();
  });
});

describe('usage_daily columns', () => {
  it('should have expected column definitions', () => {
    expect(usageDaily.id).toBeDefined();
    expect(usageDaily.workspaceId).toBeDefined();
    expect(usageDaily.date).toBeDefined();
    expect(usageDaily.eventsReceived).toBeDefined();
    expect(usageDaily.deliveriesAttempted).toBeDefined();
  });
});

describe('inferred types', () => {
  it('should have correct Workspace type shape', () => {
    const w: Workspace = {
      id: 'ws_123',
      email: 'test@example.com',
      passwordHash: 'hashed',
      name: 'Test',
      slug: 'test',
      tierSlug: 'paper-plane',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      isPlayground: 0,
      captchaEnabled: 0,
      totpSecret: null,
      totpEnabled: 0,
      createdAt: 1000000,
      updatedAt: 1000000,
    };
    expect(w.id).toBe('ws_123');
  });

  it('should have correct NewWorkspace type (insert)', () => {
    const nw: NewWorkspace = {
      id: 'ws_456',
      email: 'new@example.com',
      passwordHash: 'hashed',
      name: 'New Workspace',
      slug: 'new-workspace',
      isPlayground: 0,
      createdAt: 1000000,
      updatedAt: 1000000,
    };
    // tierSlug should be optional (has default)
    expect(nw.tierSlug).toBeUndefined();
  });
});
