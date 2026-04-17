/**
 * W3C Trace Context utilities (Phase 1 — header generation/parsing).
 * Propagation in outbound fetches is handled by @microlabs/otel-cf-workers
 * via includeTraceContext: true. These helpers are for testing and for
 * manual header injection in Phase 3 (tracestate with Hookwing metadata).
 */

export interface SpanContext {
  traceId: string;  // 32 hex chars
  spanId: string;   // 16 hex chars
  traceFlags: number; // 0x01 = sampled
}

/**
 * Produces a W3C traceparent header value.
 * Format: 00-{traceId}-{spanId}-{flags}
 */
export function formatTraceparent(ctx: SpanContext): string {
  const flags = ctx.traceFlags.toString(16).padStart(2, '0');
  return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
}

/**
 * Produces a tracestate value with Hookwing metadata.
 * Format: hookwing=eid:{endpointId},did:{deliveryId}
 */
export function formatTracestate(endpointId: string, deliveryId: string): string {
  return `hookwing=eid:${endpointId},did:${deliveryId}`;
}

/**
 * Validates a traceparent header value against the W3C spec.
 * Returns true if the format is valid.
 */
export function isValidTraceparent(value: string): boolean {
  // 00-{32 hex}-{16 hex}-{2 hex}
  return /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/.test(value);
}

/**
 * Parses a traceparent header into its components.
 * Returns null if the format is invalid.
 */
export function parseTraceparent(value: string): SpanContext | null {
  if (!isValidTraceparent(value)) return null;
  const parts = value.split('-');
  return {
    traceId: parts[1],
    spanId: parts[2],
    traceFlags: parseInt(parts[3], 16),
  };
}
