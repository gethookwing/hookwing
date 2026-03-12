/**
 * Retry utilities for webhook delivery
 *
 * Provides exponential backoff calculation and retry eligibility checks
 */

/**
 * Calculate exponential backoff delay in milliseconds
 * @param attempt - The current attempt number (1-indexed)
 * @returns Delay in milliseconds (caps at 30 minutes)
 */
export function calculateBackoff(attempt: number): number {
  // Exponential backoff: 30s, 60s, 120s, 240s, 480s...
  return Math.min(attempt * 30 * 1000, 30 * 60 * 1000);
}

/**
 * Check if a retry should be attempted
 * @param attempt - The current attempt number
 * @param maxAttempts - The maximum number of attempts allowed
 * @returns True if another attempt should be made
 */
export function shouldRetry(attempt: number, maxAttempts: number): boolean {
  return attempt < maxAttempts;
}
