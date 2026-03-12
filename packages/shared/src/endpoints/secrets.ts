/**
 * Signing secret generation for webhook endpoints
 *
 * Format: whsec_<32 random alphanumeric chars>
 */

const SECRET_PREFIX = 'whsec_';
const SECRET_LENGTH = 32;

/**
 * Generate a cryptographically secure signing secret for webhook endpoints
 * @returns A signing secret with format: whsec_<32 random alphanumeric chars>
 */
export async function generateSigningSecret(): Promise<string> {
  const randomBytes = new Uint8Array(SECRET_LENGTH);
  crypto.getRandomValues(randomBytes);

  // Alphanumeric characters (uppercase + lowercase + digits)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charsArray = chars.split('');
  let randomPart = '';
  for (let i = 0; i < SECRET_LENGTH; i++) {
    const byte = randomBytes[i];
    if (byte === undefined) continue;
    const charIndex = byte % charsArray.length;
    randomPart += charsArray[charIndex] as string;
  }

  return SECRET_PREFIX + randomPart;
}
