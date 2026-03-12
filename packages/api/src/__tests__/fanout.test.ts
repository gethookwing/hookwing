import { endpointCreateSchema, endpointUpdateSchema } from '@hookwing/shared';
import { describe, expect, it } from 'vitest';

describe('endpointCreateSchema', () => {
  it('should accept valid endpoint with fanoutEnabled defaulting to true', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fanoutEnabled).toBe(true);
    }
  });

  it('should accept endpoint with fanoutEnabled explicitly set to false', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      fanoutEnabled: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fanoutEnabled).toBe(false);
    }
  });

  it('should accept endpoint with fanoutEnabled explicitly set to true', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      fanoutEnabled: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fanoutEnabled).toBe(true);
    }
  });

  it('should accept endpoint with eventTypes filter', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      eventTypes: ['user.created', 'user.updated'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept endpoint with both eventTypes and fanoutEnabled', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      eventTypes: ['user.created'],
      fanoutEnabled: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventTypes).toEqual(['user.created']);
      expect(result.data.fanoutEnabled).toBe(false);
    }
  });

  it('should reject endpoint with invalid URL', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'http://example.com/webhook', // Not HTTPS
    });
    expect(result.success).toBe(false);
  });
});

describe('endpointUpdateSchema', () => {
  it('should accept update with fanoutEnabled', () => {
    const result = endpointUpdateSchema.safeParse({
      fanoutEnabled: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fanoutEnabled).toBe(false);
    }
  });

  it('should accept update with fanoutEnabled set to true', () => {
    const result = endpointUpdateSchema.safeParse({
      fanoutEnabled: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fanoutEnabled).toBe(true);
    }
  });

  it('should accept update with multiple fields including fanoutEnabled', () => {
    const result = endpointUpdateSchema.safeParse({
      url: 'https://example.com/new-webhook',
      fanoutEnabled: false,
      isActive: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fanoutEnabled).toBe(false);
      expect(result.data.isActive).toBe(true);
    }
  });
});
