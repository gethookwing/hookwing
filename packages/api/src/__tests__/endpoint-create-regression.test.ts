import { describe, expect, it } from 'vitest';
import { buildEndpointInsertValues } from '../routes/endpoints';

describe('buildEndpointInsertValues', () => {
  it('omits optional endpoint columns when they are not provided', () => {
    const values = buildEndpointInsertValues({
      endpointId: 'ep_test_123',
      workspaceId: 'ws_test_123',
      url: 'https://example.com/webhook',
      signingSecret: 'whsec_test_123',
      now: 1234567890,
    });

    expect(values).toEqual({
      id: 'ep_test_123',
      workspaceId: 'ws_test_123',
      url: 'https://example.com/webhook',
      description: null,
      secret: 'whsec_test_123',
      isActive: 1,
      createdAt: 1234567890,
      updatedAt: 1234567890,
    });

    expect(values).not.toHaveProperty('fanoutEnabled');
    expect(values).not.toHaveProperty('eventTypes');
    expect(values).not.toHaveProperty('metadata');
    expect(values).not.toHaveProperty('customHeaders');
    expect(values).not.toHaveProperty('ipWhitelist');
  });

  it('includes optional columns only when explicitly used', () => {
    const values = buildEndpointInsertValues({
      endpointId: 'ep_test_123',
      workspaceId: 'ws_test_123',
      url: 'https://example.com/webhook',
      description: 'Primary endpoint',
      signingSecret: 'whsec_test_123',
      eventTypes: ['invoice.paid'],
      fanoutEnabled: false,
      metadata: { env: 'prod' },
      customHeaders: { 'X-Test': '1' },
      ipWhitelist: ['203.0.113.10'],
      now: 1234567890,
    });

    expect(values).toMatchObject({
      id: 'ep_test_123',
      workspaceId: 'ws_test_123',
      url: 'https://example.com/webhook',
      description: 'Primary endpoint',
      secret: 'whsec_test_123',
      isActive: 1,
      fanoutEnabled: 0,
      createdAt: 1234567890,
      updatedAt: 1234567890,
    });
    expect(values.eventTypes).toBe('["invoice.paid"]');
    expect(values.metadata).toBe('{"env":"prod"}');
    expect(values.customHeaders).toBe('{"X-Test":"1"}');
    expect(values.ipWhitelist).toBe('["203.0.113.10"]');
  });
});
