import { describe, expect, it } from 'vitest';
import { generateWebhookSignature, verifyWebhookSignature } from '../events';

describe('generateWebhookSignature', () => {
  it('should return signature in sha256=<hex> format', async () => {
    const signature = await generateWebhookSignature('test payload', 'mysecret');
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('should produce consistent signatures for same input', async () => {
    const sig1 = await generateWebhookSignature('test payload', 'mysecret');
    const sig2 = await generateWebhookSignature('test payload', 'mysecret');
    expect(sig1).toBe(sig2);
  });

  it('should produce different signatures for different secrets', async () => {
    const sig1 = await generateWebhookSignature('test payload', 'secret1');
    const sig2 = await generateWebhookSignature('test payload', 'secret2');
    expect(sig1).not.toBe(sig2);
  });

  it('should produce different signatures for different payloads', async () => {
    const sig1 = await generateWebhookSignature('payload1', 'mysecret');
    const sig2 = await generateWebhookSignature('payload2', 'mysecret');
    expect(sig1).not.toBe(sig2);
  });

  it('should handle empty payload', async () => {
    const signature = await generateWebhookSignature('', 'mysecret');
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('should handle minimal valid secret', async () => {
    const signature = await generateWebhookSignature('test payload', 'x');
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});

describe('verifyWebhookSignature', () => {
  it('should return true for valid signature', async () => {
    const payload = 'test payload';
    const secret = 'mysecret';
    const signature = await generateWebhookSignature(payload, secret);
    const result = await verifyWebhookSignature(payload, secret, signature);
    expect(result).toBe(true);
  });

  it('should return false for invalid signature', async () => {
    const payload = 'test payload';
    const secret = 'mysecret';
    const result = await verifyWebhookSignature(payload, secret, 'sha256=invalid');
    expect(result).toBe(false);
  });

  it('should return false for tampered payload', async () => {
    const payload = 'test payload';
    const secret = 'mysecret';
    const signature = await generateWebhookSignature(payload, secret);
    const tamperedPayload = 'tampered payload';
    const result = await verifyWebhookSignature(tamperedPayload, secret, signature);
    expect(result).toBe(false);
  });

  it('should return false for wrong secret', async () => {
    const payload = 'test payload';
    const signature = await generateWebhookSignature(payload, 'correctsecret');
    const result = await verifyWebhookSignature(payload, 'wrongsecret', signature);
    expect(result).toBe(false);
  });

  it('should return false for missing sha256 prefix', async () => {
    const payload = 'test payload';
    const secret = 'mysecret';
    const signature = await generateWebhookSignature(payload, secret);
    const withoutPrefix = signature.slice(7); // Remove "sha256="
    const result = await verifyWebhookSignature(payload, secret, withoutPrefix);
    expect(result).toBe(false);
  });

  it('should return false for wrong signature format', async () => {
    const result = await verifyWebhookSignature('payload', 'secret', 'md5=abc123');
    expect(result).toBe(false);
  });

  it('should return false for empty signature', async () => {
    const result = await verifyWebhookSignature('payload', 'secret', '');
    expect(result).toBe(false);
  });

  it('should handle unicode payloads correctly', async () => {
    const payload = '{"event": "测试", "data": "数据"}';
    const secret = 'mysecret';
    const signature = await generateWebhookSignature(payload, secret);
    const result = await verifyWebhookSignature(payload, secret, signature);
    expect(result).toBe(true);
  });
});
