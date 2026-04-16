/**
 * End-to-end tests for webhook signature verification
 *
 * Covers the full round-trip: computing signatures the way each source
 * provider does it, then verifying them through verifySourceSignature.
 *
 * Tests not covered by the unit-level source-verification.test.ts:
 * - Full round-trips (compute → verify) for each provider
 * - Cross-source forgery: a valid signature for provider A must NOT pass for provider B
 * - Case-insensitive header matching (providers may lowercase header names)
 * - Empty and non-JSON payloads
 * - Multiple v1 tokens in Stripe signature (resilience to extra tokens)
 * - Secret mismatch (different secret than used to sign)
 * - Constant-time equality: different-length signatures are always false
 */

import { describe, expect, it } from 'vitest';
import { verifySourceSignature } from '../shared/source-verification';

// ---------------------------------------------------------------------------
// Helpers — mirrors the exact signing logic each provider uses
// ---------------------------------------------------------------------------

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
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Full round-trip tests
// ---------------------------------------------------------------------------

describe('webhook-signature-verification-e2e – full round-trips', () => {
  const secret = 'my-webhook-secret-key';

  describe('GitHub round-trip', () => {
    const body = JSON.stringify({ action: 'push', ref: 'refs/heads/main' });

    it('accepts a correctly computed sha256 signature', async () => {
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

    it('rejects when signature was computed with a different secret', async () => {
      const hex = await hmacHex('wrong-secret', body);
      const result = await verifySourceSignature(
        'github',
        body,
        {
          'X-Hub-Signature-256': `sha256=${hex}`,
        },
        secret,
      );
      expect(result.valid).toBe(false);
    });

    it('rejects when body was tampered after signing', async () => {
      const hex = await hmacHex(secret, body);
      const tampered = `${body} `;
      const result = await verifySourceSignature(
        'github',
        tampered,
        {
          'X-Hub-Signature-256': `sha256=${hex}`,
        },
        secret,
      );
      expect(result.valid).toBe(false);
    });

    it('accepts lowercase header name (case-insensitive match)', async () => {
      const hex = await hmacHex(secret, body);
      const result = await verifySourceSignature(
        'github',
        body,
        {
          'x-hub-signature-256': `sha256=${hex}`,
        },
        secret,
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('Shopify round-trip', () => {
    const body = JSON.stringify({ topic: 'orders/create', shop: 'test.myshopify.com' });

    it('accepts a correctly computed base64 signature', async () => {
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

    it('rejects when signature was computed with a different secret', async () => {
      const b64 = await hmacBase64('other-secret', body);
      const result = await verifySourceSignature(
        'shopify',
        body,
        {
          'X-Shopify-Hmac-Sha256': b64,
        },
        secret,
      );
      expect(result.valid).toBe(false);
    });

    it('rejects when body was tampered after signing', async () => {
      const b64 = await hmacBase64(secret, body);
      const tampered = body.replace('orders/create', 'orders/delete');
      const result = await verifySourceSignature(
        'shopify',
        tampered,
        {
          'X-Shopify-Hmac-Sha256': b64,
        },
        secret,
      );
      expect(result.valid).toBe(false);
    });

    it('accepts lowercase header name', async () => {
      const b64 = await hmacBase64(secret, body);
      const result = await verifySourceSignature(
        'shopify',
        body,
        {
          'x-shopify-hmac-sha256': b64,
        },
        secret,
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('Stripe round-trip', () => {
    const timestamp = '1700000000';
    const body = JSON.stringify({ type: 'payment_intent.succeeded', id: 'pi_test123' });

    it('accepts a correctly computed stripe signature', async () => {
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

    it('rejects when timestamp is different from what was signed', async () => {
      const signedPayload = `${timestamp}.${body}`;
      const hex = await hmacHex(secret, signedPayload);
      // Use a different timestamp in the header
      const result = await verifySourceSignature(
        'stripe',
        body,
        {
          'Stripe-Signature': `t=1700000001,v1=${hex}`,
        },
        secret,
      );
      expect(result.valid).toBe(false);
    });

    it('rejects when body was tampered after signing', async () => {
      const signedPayload = `${timestamp}.${body}`;
      const hex = await hmacHex(secret, signedPayload);
      const tampered = body.replace('succeeded', 'failed');
      const result = await verifySourceSignature(
        'stripe',
        tampered,
        {
          'Stripe-Signature': `t=${timestamp},v1=${hex}`,
        },
        secret,
      );
      expect(result.valid).toBe(false);
    });

    it('accepts lowercase header name', async () => {
      const signedPayload = `${timestamp}.${body}`;
      const hex = await hmacHex(secret, signedPayload);
      const result = await verifySourceSignature(
        'stripe',
        body,
        {
          'stripe-signature': `t=${timestamp},v1=${hex}`,
        },
        secret,
      );
      expect(result.valid).toBe(true);
    });

    it('accepts signature when additional v0 token is present', async () => {
      const signedPayload = `${timestamp}.${body}`;
      const hex = await hmacHex(secret, signedPayload);
      // Stripe may include v0 token alongside v1
      const result = await verifySourceSignature(
        'stripe',
        body,
        {
          'Stripe-Signature': `t=${timestamp},v0=oldsig,v1=${hex}`,
        },
        secret,
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('Linear round-trip', () => {
    const body = JSON.stringify({ action: 'create', type: 'Issue', data: { id: 'iss_123' } });

    it('accepts a correctly computed hex signature', async () => {
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

    it('rejects when signature was computed with a different secret', async () => {
      const hex = await hmacHex('bad-secret', body);
      const result = await verifySourceSignature(
        'linear',
        body,
        {
          'Linear-Signature': hex,
        },
        secret,
      );
      expect(result.valid).toBe(false);
    });

    it('rejects when body was tampered after signing', async () => {
      const hex = await hmacHex(secret, body);
      const tampered = body.replace('create', 'delete');
      const result = await verifySourceSignature(
        'linear',
        tampered,
        {
          'Linear-Signature': hex,
        },
        secret,
      );
      expect(result.valid).toBe(false);
    });

    it('accepts lowercase header name', async () => {
      const hex = await hmacHex(secret, body);
      const result = await verifySourceSignature(
        'linear',
        body,
        {
          'linear-signature': hex,
        },
        secret,
      );
      expect(result.valid).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Cross-source forgery tests
// ---------------------------------------------------------------------------

describe('webhook-signature-verification-e2e – cross-source forgery prevention', () => {
  const secret = 'shared-secret';
  const body = JSON.stringify({ event: 'test' });

  it('GitHub signature cannot pass as Stripe verification', async () => {
    const hex = await hmacHex(secret, body);
    // GitHub sig format (hex), presented to Stripe verifier
    const result = await verifySourceSignature(
      'stripe',
      body,
      {
        'X-Hub-Signature-256': `sha256=${hex}`,
        // Stripe header missing — should fail
      },
      secret,
    );
    expect(result.valid).toBe(false);
  });

  it('Shopify signature cannot pass as GitHub verification', async () => {
    const b64 = await hmacBase64(secret, body);
    // Shopify puts base64 in its header; present it as GitHub sha256 prefix
    const result = await verifySourceSignature(
      'github',
      body,
      {
        'X-Hub-Signature-256': `sha256=${b64}`,
      },
      secret,
    );
    // base64 != hex, should fail
    expect(result.valid).toBe(false);
  });

  it('Stripe signature cannot pass as Linear verification (wrong header)', async () => {
    const timestamp = '1700000000';
    const hex = await hmacHex(secret, `${timestamp}.${body}`);
    // Linear expects raw hex of body only, not timestamp.body
    const result = await verifySourceSignature(
      'linear',
      body,
      {
        'Linear-Signature': hex,
      },
      secret,
    );
    // The signature was computed over "timestamp.body", not "body", so mismatch
    expect(result.valid).toBe(false);
  });

  it('Linear signature cannot pass as GitHub verification (correct format, different prefix)', async () => {
    // Linear = raw hex, GitHub = sha256=<hex>
    const hex = await hmacHex(secret, body);
    const result = await verifySourceSignature(
      'github',
      body,
      {
        'X-Hub-Signature-256': hex, // Missing "sha256=" prefix
      },
      secret,
    );
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge case payloads
// ---------------------------------------------------------------------------

describe('webhook-signature-verification-e2e – edge case payloads', () => {
  const secret = 'edge-case-secret';

  it('handles empty body for GitHub', async () => {
    const body = '';
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

  it('handles empty body for Shopify', async () => {
    const body = '';
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

  it('handles non-JSON (plain text) body for Linear', async () => {
    const body = 'plain text webhook payload';
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

  it('handles large payload for GitHub', async () => {
    const body = JSON.stringify({ data: 'x'.repeat(50000) });
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

  it('handles unicode payload for Stripe', async () => {
    const body = JSON.stringify({ name: 'Ångström café – naïve résumé' });
    const timestamp = '1700000000';
    const hex = await hmacHex(secret, `${timestamp}.${body}`);
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

  it('unknown provider always passes through (no verification)', async () => {
    const body = '{"event":"test"}';
    // No signature header at all — unknown provider skips verification
    const result = await verifySourceSignature('zapier', body, {}, secret);
    expect(result.valid).toBe(true);
  });

  it('unknown provider passes even with mismatched headers', async () => {
    const result = await verifySourceSignature(
      'custom-webhook-provider',
      '{}',
      {
        'X-Hub-Signature-256': 'sha256=invalidsig',
      },
      secret,
    );
    expect(result.valid).toBe(true);
  });
});
