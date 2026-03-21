/**
 * ID generation utilities
 *
 * Format: <prefix>_<random chars>
 * Uses crypto.getRandomValues for secure random generation
 */

const ID_LENGTH = 16;
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a cryptographically secure ID with a prefix
 * @param prefix - The prefix for the ID (e.g., 'ws', 'key', 'evt')
 * @returns A unique ID like 'ws_abc123...'
 */
export function generateId(prefix: string): string {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);

  const charsArray = CHARS.split('');
  let randomPart = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    const charIndex = byte % charsArray.length;
    randomPart += charsArray[charIndex] as string;
  }

  return `${prefix}_${randomPart}`;
}
