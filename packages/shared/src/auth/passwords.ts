/**
 * Password hashing utilities
 *
 * Uses PBKDF2 with SHA-256 and 100,000 iterations
 * Compatible with Cloudflare Workers (Web Crypto API)
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

/**
 * Hash a password using PBKDF2-SHA256
 * @param password - The plain text password
 * @returns Salted hash in format: base64(salt):base64(hash)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Generate a random salt
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);

  // Derive the key using PBKDF2
  const keyBuffer = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, [
    'deriveBits',
  ]);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyBuffer,
    HASH_LENGTH * 8,
  );

  const hash = new Uint8Array(derivedBits);

  // Convert to base64 for storage
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...hash));

  return `${saltBase64}:${hashBase64}`;
}

/**
 * Verify a password against a stored hash
 * @param password - The plain text password to verify
 * @param storedHash - The stored hash (salt:hash format)
 * @returns true if the password matches
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Parse the stored hash
  const [saltBase64, hashBase64] = storedHash.split(':');
  if (!saltBase64 || !hashBase64) {
    return false;
  }

  const salt = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0));
  const expectedHash = Uint8Array.from(atob(hashBase64), (c) => c.charCodeAt(0));

  // Derive the key using the same parameters
  const keyBuffer = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, [
    'deriveBits',
  ]);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyBuffer,
    HASH_LENGTH * 8,
  );

  const derivedHash = new Uint8Array(derivedBits);

  // Constant-time comparison
  if (derivedHash.length !== expectedHash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < derivedHash.length; i++) {
    const dh = derivedHash[i];
    const eh = expectedHash[i];
    if (dh !== undefined && eh !== undefined) {
      result |= dh ^ eh;
    }
  }

  return result === 0;
}
