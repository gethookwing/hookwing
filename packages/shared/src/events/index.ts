/**
 * Webhook signature utilities
 *
 * HMAC-SHA256 signature generation and verification for webhooks
 */

/**
 * Generate HMAC-SHA256 signature for outgoing webhook deliveries
 * @param payload - The raw request body
 * @param secret - The signing secret
 * @returns Signature in format "sha256=<64 hex characters>"
 */
export async function generateWebhookSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
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
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return `sha256=${hashHex}`;
}

/**
 * Verify webhook signature against payload
 * @param payload - The raw request body
 * @param secret - The signing secret
 * @param signatureHeader - The signature from the request header (format: "sha256=<hex>")
 * @returns True if signature is valid
 */
export async function verifyWebhookSignature(
  payload: string,
  secret: string,
  signatureHeader: string,
): Promise<boolean> {
  // Validate signature format
  if (!signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = signatureHeader.slice(7); // Remove "sha256=" prefix

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
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
  const actualSignature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  // Constant-time comparison to prevent timing attacks
  if (expectedSignature.length !== actualSignature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    result |= expectedSignature.charCodeAt(i) ^ actualSignature.charCodeAt(i);
  }

  return result === 0;
}
