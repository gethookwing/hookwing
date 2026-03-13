import { describe, expect, it } from 'vitest';
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  Webhook,
  WebhookVerificationError,
} from '../webhook.js';

const SECRET = 'whsec_testSecretForUnitTests1234567890';
const PAYLOAD = JSON.stringify({
  id: 'evt_01',
  type: 'order.created',
  data: { orderId: 'ord_123' },
});

async function sign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(raw),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hex}`;
}

describe('Webhook constructor', () => {
  it('should throw if secret is empty', () => {
    expect(() => new Webhook('')).toThrow('Webhook secret is required');
  });

  it('should accept secret with whsec_ prefix', () => {
    expect(() => new Webhook('whsec_abc123')).not.toThrow();
  });

  it('should accept secret without prefix', () => {
    expect(() => new Webhook('rawsecret123')).not.toThrow();
  });

  it('should accept custom tolerance', () => {
    expect(() => new Webhook(SECRET, { toleranceMs: 60000 })).not.toThrow();
  });
});

describe('Webhook.verifySignature', () => {
  it('should return true for a valid signature', async () => {
    const wh = new Webhook(SECRET);
    const sig = await sign(PAYLOAD, SECRET);
    expect(await wh.verifySignature(PAYLOAD, sig)).toBe(true);
  });

  it('should return false for an invalid signature', async () => {
    const wh = new Webhook(SECRET);
    expect(await wh.verifySignature(PAYLOAD, 'sha256=deadbeef')).toBe(false);
  });

  it('should return false for missing sha256= prefix', async () => {
    const wh = new Webhook(SECRET);
    const sig = await sign(PAYLOAD, SECRET);
    expect(await wh.verifySignature(PAYLOAD, sig.slice(7))).toBe(false); // Remove sha256=
  });

  it('should return false if payload is modified', async () => {
    const wh = new Webhook(SECRET);
    const sig = await sign(PAYLOAD, SECRET);
    expect(await wh.verifySignature(`${PAYLOAD} `, sig)).toBe(false);
  });

  it('should return false for wrong secret', async () => {
    const wh = new Webhook('whsec_wrongSecret12345678901234567890');
    const sig = await sign(PAYLOAD, SECRET);
    expect(await wh.verifySignature(PAYLOAD, sig)).toBe(false);
  });
});

describe('Webhook.verify', () => {
  it('should throw on missing signature header', async () => {
    const wh = new Webhook(SECRET, { toleranceMs: 999999999 });
    await expect(
      wh.verify(PAYLOAD, { signature: null, timestamp: String(Date.now()) }),
    ).rejects.toThrow(WebhookVerificationError);
  });

  it('should throw on missing timestamp header', async () => {
    const wh = new Webhook(SECRET, { toleranceMs: 999999999 });
    const sig = await sign(PAYLOAD, SECRET);
    await expect(wh.verify(PAYLOAD, { signature: sig, timestamp: null })).rejects.toThrow(
      WebhookVerificationError,
    );
  });

  it('should throw on stale timestamp', async () => {
    const wh = new Webhook(SECRET, { toleranceMs: 1000 });
    const sig = await sign(PAYLOAD, SECRET);
    const oldTs = String(Date.now() - 10000); // 10s ago, tolerance is 1s
    await expect(wh.verify(PAYLOAD, { signature: sig, timestamp: oldTs })).rejects.toThrow(
      'timestamp too old',
    );
  });

  it('should succeed with valid signature and fresh timestamp', async () => {
    const wh = new Webhook(SECRET, { toleranceMs: 999999999 });
    const sig = await sign(PAYLOAD, SECRET);
    const ts = String(Date.now());
    const event = await wh.verify(PAYLOAD, { signature: sig, timestamp: ts });
    expect(event.type).toBe('order.created');
    expect(event.id).toBe('evt_01');
  });

  it('should throw WebhookVerificationError on bad signature', async () => {
    const wh = new Webhook(SECRET, { toleranceMs: 999999999 });
    await expect(
      wh.verify(PAYLOAD, { signature: 'sha256=badbad', timestamp: String(Date.now()) }),
    ).rejects.toThrow(WebhookVerificationError);
  });

  it('should throw on invalid JSON payload', async () => {
    const wh = new Webhook(SECRET, { toleranceMs: 999999999 });
    const badPayload = 'not json';
    const sig = await sign(badPayload, SECRET);
    await expect(
      wh.verify(badPayload, { signature: sig, timestamp: String(Date.now()) }),
    ).rejects.toThrow('not valid JSON');
  });
});

describe('header constants', () => {
  it('should export correct header names', () => {
    expect(SIGNATURE_HEADER).toBe('x-hookwing-signature');
    expect(TIMESTAMP_HEADER).toBe('x-hookwing-timestamp');
  });
});
