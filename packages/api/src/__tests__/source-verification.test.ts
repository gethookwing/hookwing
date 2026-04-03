import { describe, expect, it } from 'vitest';
import { verifySourceSignature } from '../shared/source-verification';

/** Helper to compute HMAC-SHA256 hex */
async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Helper to compute HMAC-SHA256 base64 */
async function hmacBase64(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}

describe('verifySourceSignature', () => {
  const secret = 'test_secret_key';
  const body = '{"event":"test"}';

  describe('github', () => {
    it('should verify valid GitHub signature', async () => {
      const hex = await hmacHex(secret, body);
      const result = await verifySourceSignature(
        'github',
        body,
        {
          'X-Hub-Signature-256': `sha256=${hex}`,
        },
        secret,
      );
      expect(result.valid).toBe(true);
    });

    it('should reject invalid GitHub signature', async () => {
      const result = await verifySourceSignature(
        'github',
        body,
        {
          'X-Hub-Signature-256':
            'sha256=0000000000000000000000000000000000000000000000000000000000000000',
        },
        secret,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('GitHub signature mismatch');
    });

    it('should reject missing GitHub signature header', async () => {
      const result = await verifySourceSignature('github', body, {}, secret);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing X-Hub-Signature-256');
    });

    it('should reject invalid GitHub signature format', async () => {
      const result = await verifySourceSignature(
        'github',
        body,
        {
          'X-Hub-Signature-256': 'invalid-format',
        },
        secret,
      );
      expect(result.valid).toBe(false);
    });
  });

  describe('shopify', () => {
    it('should verify valid Shopify signature', async () => {
      const b64 = await hmacBase64(secret, body);
      const result = await verifySourceSignature(
        'shopify',
        body,
        {
          'X-Shopify-Hmac-Sha256': b64,
        },
        secret,
      );
      expect(result.valid).toBe(true);
    });

    it('should reject invalid Shopify signature', async () => {
      const result = await verifySourceSignature(
        'shopify',
        body,
        {
          'X-Shopify-Hmac-Sha256': 'aW52YWxpZA==',
        },
        secret,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Shopify signature mismatch');
    });

    it('should reject missing Shopify signature header', async () => {
      const result = await verifySourceSignature('shopify', body, {}, secret);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing X-Shopify-Hmac-Sha256');
    });
  });

  describe('stripe', () => {
    it('should verify valid Stripe signature', async () => {
      const timestamp = '1616000000';
      const signedPayload = `${timestamp}.${body}`;
      const hex = await hmacHex(secret, signedPayload);
      const result = await verifySourceSignature(
        'stripe',
        body,
        {
          'Stripe-Signature': `t=${timestamp},v1=${hex}`,
        },
        secret,
      );
      expect(result.valid).toBe(true);
    });

    it('should reject invalid Stripe signature', async () => {
      const result = await verifySourceSignature(
        'stripe',
        body,
        {
          'Stripe-Signature':
            't=1616000000,v1=0000000000000000000000000000000000000000000000000000000000000000',
        },
        secret,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Stripe signature mismatch');
    });

    it('should reject missing Stripe signature header', async () => {
      const result = await verifySourceSignature('stripe', body, {}, secret);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing Stripe-Signature');
    });

    it('should reject malformed Stripe signature format', async () => {
      const result = await verifySourceSignature(
        'stripe',
        body,
        {
          'Stripe-Signature': 'malformed',
        },
        secret,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid Stripe-Signature format');
    });
  });

  describe('linear', () => {
    it('should verify valid Linear signature', async () => {
      const hex = await hmacHex(secret, body);
      const result = await verifySourceSignature(
        'linear',
        body,
        {
          'Linear-Signature': hex,
        },
        secret,
      );
      expect(result.valid).toBe(true);
    });

    it('should reject invalid Linear signature', async () => {
      const result = await verifySourceSignature(
        'linear',
        body,
        {
          'Linear-Signature': '0000000000000000000000000000000000000000000000000000000000000000',
        },
        secret,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Linear signature mismatch');
    });

    it('should reject missing Linear signature header', async () => {
      const result = await verifySourceSignature('linear', body, {}, secret);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing Linear-Signature');
    });
  });

  describe('unknown source', () => {
    it('should pass through for unknown source ID', async () => {
      const result = await verifySourceSignature('unknown-provider', body, {}, secret);
      expect(result.valid).toBe(true);
    });

    it('should pass through for empty headers', async () => {
      const result = await verifySourceSignature('totally-unknown', body, {}, secret);
      expect(result.valid).toBe(true);
    });
  });
});
