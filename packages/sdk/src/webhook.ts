/**
 * Hookwing Webhook verifier
 *
 * Verifies HMAC-SHA256 signatures on incoming Hookwing webhook deliveries.
 * Works in Node.js (v18+), browsers, and edge runtimes (Cloudflare Workers, etc.)
 *
 * @example
 * ```ts
 * import { Webhook } from '@hookwing/sdk';
 *
 * const wh = new Webhook('whsec_your_signing_secret');
 *
 * // In your webhook handler:
 * const payload = await request.text();
 * const signature = request.headers.get('X-Hookwing-Signature');
 * const timestamp = request.headers.get('X-Hookwing-Timestamp');
 *
 * const event = await wh.verify(payload, { signature, timestamp });
 * // event is typed as WebhookEvent
 * ```
 */

export const SIGNATURE_HEADER = 'x-hookwing-signature';
export const TIMESTAMP_HEADER = 'x-hookwing-timestamp';
export const EVENT_TYPE_HEADER = 'x-event-type';

/** Default tolerance window for timestamp verification (5 minutes) */
const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;

export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: number;
  payload: unknown;
}

export interface VerifyHeaders {
  signature: string | null;
  timestamp: string | null;
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

export class Webhook {
  private readonly secret: string;
  private readonly toleranceMs: number;

  constructor(secret: string, options?: { toleranceMs?: number }) {
    if (!secret) {
      throw new Error('Webhook secret is required');
    }
    this.secret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    this.toleranceMs = options?.toleranceMs ?? DEFAULT_TOLERANCE_MS;
  }

  /**
   * Verify a webhook payload and return the parsed event.
   * Throws WebhookVerificationError if the signature is invalid or the timestamp is stale.
   */
  async verify(payload: string, headers: VerifyHeaders): Promise<WebhookEvent> {
    const { signature, timestamp } = headers;

    if (!signature) {
      throw new WebhookVerificationError('Missing X-Hookwing-Signature header');
    }
    if (!timestamp) {
      throw new WebhookVerificationError('Missing X-Hookwing-Timestamp header');
    }

    // Validate timestamp format and staleness
    const ts = Number(timestamp);
    if (Number.isNaN(ts)) {
      throw new WebhookVerificationError('Invalid X-Hookwing-Timestamp header');
    }

    const now = Date.now();
    const age = Math.abs(now - ts);
    if (age > this.toleranceMs) {
      throw new WebhookVerificationError(
        `Webhook timestamp too old (${Math.round(age / 1000)}s ago, tolerance: ${Math.round(this.toleranceMs / 1000)}s)`,
      );
    }

    // Verify HMAC signature
    const isValid = await this.verifySignature(payload, signature);
    if (!isValid) {
      throw new WebhookVerificationError('Webhook signature verification failed');
    }

    // Parse payload
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new WebhookVerificationError('Webhook payload is not valid JSON');
    }

    const event = parsed as Record<string, unknown>;

    return {
      id: typeof event.id === 'string' ? event.id : '',
      type: typeof event.type === 'string' ? event.type : 'unknown',
      timestamp: ts,
      payload: event,
    };
  }

  /**
   * Verify signature only (without timestamp check).
   * Use `verify()` in production — this is for testing.
   */
  async verifySignature(payload: string, signatureHeader: string): Promise<boolean> {
    if (!signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const expectedSig = signatureHeader.slice(7);
    const actualSig = await this.computeHmac(payload);

    // Constant-time comparison
    if (expectedSig.length !== actualSig.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < expectedSig.length; i++) {
      result |= (expectedSig.codePointAt(i) ?? 0) ^ (actualSig.codePointAt(i) ?? 0);
    }
    return result === 0;
  }

  private async computeHmac(payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.secret);
    const messageData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
