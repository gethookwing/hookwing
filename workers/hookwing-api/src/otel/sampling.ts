/**
 * Sampling logic for Hookwing traces.
 *
 * Strategy:
 *   - 100% of error traces (HTTP status >= 400 or unhandled exception)
 *   - Configurable rate (default 0.1) for success traces
 *
 * This is a head-based sampling decision made at the start of each request.
 * We always sample errors by treating any observed error as forcing 100% rate.
 * At trace start (before we know the outcome), we use the configured rate.
 * The error override is applied when recording span status.
 */

export interface SamplingContext {
  isError: boolean;
  sampleRate: number;
  /** Injected random value (0–1) to make sampling deterministic in tests */
  randomValue?: number;
}

/**
 * Returns true if the trace should be sampled.
 * Always samples errors; uses sampleRate for successes.
 */
export function shouldSample(ctx: SamplingContext): boolean {
  if (ctx.isError) return true;
  const r = ctx.randomValue ?? Math.random();
  return r < ctx.sampleRate;
}

/**
 * Returns the effective sample rate string for logging/debugging.
 * Never logs secrets.
 */
export function describeSampling(sampleRate: number): string {
  return `errors=100% successes=${Math.round(sampleRate * 100)}%`;
}
