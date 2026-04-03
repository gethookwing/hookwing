/**
 * Schema validation tests for endpoint creation and update
 *
 * Tests the endpointCreateSchema and endpointUpdateSchema from @hookwing/shared
 * with edge cases around URL validation, field types, and boundary conditions.
 */

import { endpointCreateSchema, endpointUpdateSchema } from '@hookwing/shared';
import { describe, expect, it } from 'vitest';

// ============================================================================
// endpointCreateSchema
// ============================================================================

describe('endpointCreateSchema — URL validation', () => {
  it('should accept a valid HTTPS URL', () => {
    const result = endpointCreateSchema.safeParse({ url: 'https://example.com/webhook' });
    expect(result.success).toBe(true);
  });

  it('should reject HTTP URL (non-HTTPS)', () => {
    const result = endpointCreateSchema.safeParse({ url: 'http://example.com/webhook' });
    expect(result.success).toBe(false);
  });

  it('should reject a URL with no scheme', () => {
    const result = endpointCreateSchema.safeParse({ url: 'example.com/webhook' });
    expect(result.success).toBe(false);
  });

  it('should reject an empty string URL', () => {
    const result = endpointCreateSchema.safeParse({ url: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing url field', () => {
    const result = endpointCreateSchema.safeParse({ description: 'Test' });
    expect(result.success).toBe(false);
  });

  it('should accept a URL with a path and query string', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://api.example.com/hooks/receive?token=abc',
    });
    expect(result.success).toBe(true);
  });

  it('should accept a URL with a port number', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com:8443/webhook',
    });
    expect(result.success).toBe(true);
  });
});

describe('endpointCreateSchema — optional fields', () => {
  it('should accept endpoint with description', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      description: 'My webhook',
    });
    expect(result.success).toBe(true);
  });

  it('should accept endpoint with eventTypes array', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      eventTypes: ['order.created', 'order.updated', 'payment.received'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventTypes).toHaveLength(3);
    }
  });

  it('should accept endpoint with empty eventTypes array', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      eventTypes: [],
    });
    expect(result.success).toBe(true);
  });

  it('should default fanoutEnabled to true when not provided', () => {
    const result = endpointCreateSchema.safeParse({ url: 'https://example.com/webhook' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fanoutEnabled).toBe(true);
    }
  });

  it('should accept fanoutEnabled: false', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      fanoutEnabled: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fanoutEnabled).toBe(false);
    }
  });

  it('should accept metadata as an object', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      metadata: { env: 'production', version: '2' },
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// endpointUpdateSchema
// ============================================================================

describe('endpointUpdateSchema — partial updates', () => {
  it('should accept an update with only url', () => {
    const result = endpointUpdateSchema.safeParse({
      url: 'https://newurl.example.com/webhook',
    });
    expect(result.success).toBe(true);
  });

  it('should accept an update with only isActive', () => {
    const result = endpointUpdateSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
    }
  });

  it('should accept an update with only fanoutEnabled', () => {
    const result = endpointUpdateSchema.safeParse({ fanoutEnabled: true });
    expect(result.success).toBe(true);
  });

  it('should accept an update with only eventTypes', () => {
    const result = endpointUpdateSchema.safeParse({
      eventTypes: ['invoice.paid'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept an empty update object (no fields changed)', () => {
    const result = endpointUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept update with description cleared (null or empty)', () => {
    const result = endpointUpdateSchema.safeParse({ description: '' });
    expect(result.success).toBe(true);
  });

  it('should accept update with multiple fields at once', () => {
    const result = endpointUpdateSchema.safeParse({
      url: 'https://updated.example.com/hook',
      description: 'Updated webhook',
      isActive: true,
      fanoutEnabled: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
      expect(result.data.fanoutEnabled).toBe(false);
    }
  });

  it('should reject update with invalid URL (non-HTTPS)', () => {
    const result = endpointUpdateSchema.safeParse({ url: 'http://insecure.example.com' });
    expect(result.success).toBe(false);
  });
});
