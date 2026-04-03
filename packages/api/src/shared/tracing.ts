/**
 * W3C Trace Context utilities for distributed tracing.
 *
 * Implements parsing and generation of traceparent/tracestate headers
 * per the W3C Trace Context specification.
 */

const TRACEPARENT_REGEX = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const ZERO_TRACE_ID = '00000000000000000000000000000000';
const ZERO_SPAN_ID = '0000000000000000';

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

/**
 * Parse a W3C traceparent header.
 * Format: 00-<32 hex chars>-<16 hex chars>-<2 hex chars>
 * Returns null if invalid.
 */
export function parseTraceparent(header: string): TraceContext | null {
  const trimmed = header.trim();
  const match = TRACEPARENT_REGEX.exec(trimmed);
  if (!match) return null;

  const traceId = match[1] as string;
  const spanId = match[2] as string;
  const traceFlags = Number.parseInt(match[3] as string, 16);

  // All-zero trace-id and span-id are invalid per spec
  if (traceId === ZERO_TRACE_ID) return null;
  if (spanId === ZERO_SPAN_ID) return null;

  return { traceId, spanId, traceFlags };
}

/**
 * Generate a random hex string of the given byte length.
 */
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a new W3C trace context with random trace and span IDs.
 */
export function generateTraceparent(): { traceparent: string; traceId: string; spanId: string } {
  const traceId = randomHex(16); // 32 hex chars
  const spanId = randomHex(8); // 16 hex chars
  const traceparent = `00-${traceId}-${spanId}-01`;
  return { traceparent, traceId, spanId };
}

/**
 * Create a child span from a parent traceparent header.
 * Preserves the traceId but generates a new spanId.
 */
export function createChildSpan(
  parentTraceparent: string,
): { traceparent: string; traceId: string; spanId: string } | null {
  const parsed = parseTraceparent(parentTraceparent);
  if (!parsed) return null;

  const spanId = randomHex(8);
  const traceparent = `00-${parsed.traceId}-${spanId}-01`;
  return { traceparent, traceId: parsed.traceId, spanId };
}

/**
 * Parse a W3C tracestate header into a Map of key-value pairs.
 * Format: key1=value1,key2=value2
 */
export function parseTracestate(header: string): Map<string, string> {
  const state = new Map<string, string>();
  if (!header.trim()) return state;

  const pairs = header.split(',');
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key) {
      state.set(key, value);
    }
  }
  return state;
}

/**
 * Serialize a tracestate Map back into a header string.
 */
export function serializeTracestate(state: Map<string, string>): string {
  const pairs: string[] = [];
  for (const [key, value] of state) {
    pairs.push(`${key}=${value}`);
  }
  return pairs.join(',');
}
