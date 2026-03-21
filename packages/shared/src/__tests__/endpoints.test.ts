import { describe, expect, it } from 'vitest';
import { endpointCreateSchema, endpointUpdateSchema, generateSigningSecret } from '../endpoints';

describe('generateSigningSecret', () => {
  it('should return string starting with whsec_', async () => {
    const secret = await generateSigningSecret();
    expect(secret).toMatch(/^whsec_/);
  });

  it('should return string of correct length (38 chars)', async () => {
    const secret = await generateSigningSecret();
    expect(secret).toHaveLength(38); // whsec_ + 32 = 38
  });

  it('should produce unique values (100 calls, all different)', async () => {
    const secrets = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const secret = await generateSigningSecret();
      secrets.add(secret);
    }
    expect(secrets.size).toBe(100); // All unique
  });
});

describe('endpointCreateSchema', () => {
  it('should accept valid HTTPS URL', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
    });
    expect(result.success).toBe(true);
  });

  it('should reject HTTP URL', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'http://example.com/webhook',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Endpoint URL must use HTTPS');
    }
  });

  it('should reject invalid URL', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional description and eventTypes', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      description: 'My webhook endpoint',
      eventTypes: ['user.created', 'user.updated'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept optional metadata', () => {
    const result = endpointCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      metadata: { tier: 'warbird', region: 'us-east-1' },
    });
    expect(result.success).toBe(true);
  });
});

describe('endpointUpdateSchema', () => {
  it('should accept partial updates', () => {
    const result = endpointUpdateSchema.safeParse({
      url: 'https://example.com/new-webhook',
    });
    expect(result.success).toBe(true);
  });

  it('should allow nullable fields (setting to null to clear)', () => {
    const result = endpointUpdateSchema.safeParse({
      description: null,
      eventTypes: null,
      metadata: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept isActive boolean', () => {
    const result = endpointUpdateSchema.safeParse({
      isActive: false,
    });
    expect(result.success).toBe(true);
  });
});
