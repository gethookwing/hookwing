import { getWebhookSource } from '@hookwing/shared';

/**
 * Verify a third-party webhook source signature.
 *
 * Uses the source preset's signature configuration to determine
 * which header and algorithm to use for verification.
 */
export async function verifySourceSignature(
  sourceId: string,
  rawBody: string,
  headers: Record<string, string>,
  secret: string,
): Promise<{ valid: boolean; error?: string }> {
  const source = getWebhookSource(sourceId);
  if (!source) {
    // Unknown source — pass through
    return { valid: true };
  }

  switch (sourceId) {
    case 'stripe': {
      const sigHeader = headers['Stripe-Signature'] || headers['stripe-signature'];
      if (!sigHeader) {
        return { valid: false, error: 'Missing Stripe-Signature header' };
      }
      // Parse t=timestamp,v1=signature format
      const parts = sigHeader.split(',');
      let timestamp = '';
      let signature = '';
      for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 't') timestamp = value || '';
        if (key === 'v1') signature = value || '';
      }
      if (!timestamp || !signature) {
        return { valid: false, error: 'Invalid Stripe-Signature format' };
      }
      // Stripe signs: timestamp.rawBody
      const signedPayload = `${timestamp}.${rawBody}`;
      const expected = await hmacSha256Hex(secret, signedPayload);
      return constantTimeEqual(signature, expected)
        ? { valid: true }
        : { valid: false, error: 'Stripe signature mismatch' };
    }

    case 'github': {
      const sigHeader = headers['X-Hub-Signature-256'] || headers['x-hub-signature-256'];
      if (!sigHeader) {
        return { valid: false, error: 'Missing X-Hub-Signature-256 header' };
      }
      if (!sigHeader.startsWith('sha256=')) {
        return { valid: false, error: 'Invalid X-Hub-Signature-256 format' };
      }
      const signature = sigHeader.slice(7);
      const expected = await hmacSha256Hex(secret, rawBody);
      return constantTimeEqual(signature, expected)
        ? { valid: true }
        : { valid: false, error: 'GitHub signature mismatch' };
    }

    case 'shopify': {
      const sigHeader = headers['X-Shopify-Hmac-Sha256'] || headers['x-shopify-hmac-sha256'];
      if (!sigHeader) {
        return { valid: false, error: 'Missing X-Shopify-Hmac-Sha256 header' };
      }
      const expected = await hmacSha256Base64(secret, rawBody);
      return constantTimeEqual(sigHeader, expected)
        ? { valid: true }
        : { valid: false, error: 'Shopify signature mismatch' };
    }

    case 'linear': {
      const sigHeader = headers['Linear-Signature'] || headers['linear-signature'];
      if (!sigHeader) {
        return { valid: false, error: 'Missing Linear-Signature header' };
      }
      const expected = await hmacSha256Hex(secret, rawBody);
      return constantTimeEqual(sigHeader, expected)
        ? { valid: true }
        : { valid: false, error: 'Linear signature mismatch' };
    }

    default:
      // Unknown source — pass through
      return { valid: true };
  }
}

/** Compute HMAC-SHA256 and return hex-encoded string */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compute HMAC-SHA256 and return base64-encoded string */
async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}

/** Constant-time string comparison */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
