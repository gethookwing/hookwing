/**
 * API Key generation utilities
 *
 * Format: hk_live_<32 random chars>
 * - prefix: first 12 chars (hk_live_abc...)
 * - hash: SHA-256 of full key (stored in DB)
 */

const KEY_PREFIX = 'hk_live_';
const KEY_LENGTH = 32;
const PREFIX_LENGTH = 12; // hk_live_ + 4 random chars

/**
 * Generate a cryptographically secure API key
 * Returns the raw key (for display once), prefix (for lookup), and hash (for storage)
 */
export async function generateApiKey(): Promise<{
  key: string;
  prefix: string;
  hash: string;
}> {
  const randomBytes = new Uint8Array(KEY_LENGTH);
  crypto.getRandomValues(randomBytes);

  // Convert to base62-like string (alphanumeric, uppercase)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charsArray = chars.split('');
  let randomPart = '';
  for (let i = 0; i < KEY_LENGTH; i++) {
    const byte = randomBytes[i];
    if (byte === undefined) continue;
    const charIndex = byte % charsArray.length;
    randomPart += charsArray[charIndex] as string;
  }

  const key = KEY_PREFIX + randomPart;
  const prefix = key.substring(0, PREFIX_LENGTH); // hk_live_ + first 4 chars

  const hash = await hashApiKey(key);

  return {
    key,
    prefix,
    hash,
  };
}

/**
 * Hash an API key using SHA-256
 * @param key - The raw API key to hash
 * @returns SHA-256 hash as a hex string
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify an API key against a stored hash using constant-time comparison
 * @param key - The raw API key to verify
 * @param storedHash - The stored SHA-256 hash
 * @returns matches
 */
export async function verifyApiKey(key: string, storedHash: string): Promise<boolean> {
  const hash = await hashApiKey(key);

  // Constant-time comparison to prevent timing attacks
  if (hash.length !== storedHash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < hash.length; i++) {
    result |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }

  return result === 0;
}
