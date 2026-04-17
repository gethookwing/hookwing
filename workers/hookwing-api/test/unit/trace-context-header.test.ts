import { describe, it, expect } from 'vitest';
import {
  formatTraceparent,
  formatTracestate,
  isValidTraceparent,
  parseTraceparent,
} from '../../src/otel/trace-context';

const validTraceId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';  // 32 hex
const validSpanId  = 'a1b2c3d4e5f6a1b2';                    // 16 hex

describe('formatTraceparent', () => {
  it('produces the correct 00-traceId-spanId-flags format', () => {
    const result = formatTraceparent({ traceId: validTraceId, spanId: validSpanId, traceFlags: 1 });
    expect(result).toBe(`00-${validTraceId}-${validSpanId}-01`);
  });

  it('pads flags to 2 hex digits', () => {
    const result = formatTraceparent({ traceId: validTraceId, spanId: validSpanId, traceFlags: 0 });
    expect(result).toMatch(/-00$/);
  });

  it('produces a value that passes isValidTraceparent', () => {
    const val = formatTraceparent({ traceId: validTraceId, spanId: validSpanId, traceFlags: 1 });
    expect(isValidTraceparent(val)).toBe(true);
  });
});

describe('formatTracestate', () => {
  it('produces hookwing=eid:{endpointId},did:{deliveryId}', () => {
    const result = formatTracestate('ep_abc', 'del_xyz');
    expect(result).toBe('hookwing=eid:ep_abc,did:del_xyz');
  });

  it('includes both endpoint and delivery ids', () => {
    const result = formatTracestate('ep_111', 'del_222');
    expect(result).toContain('eid:ep_111');
    expect(result).toContain('did:del_222');
  });
});

describe('isValidTraceparent', () => {
  it('accepts a valid traceparent', () => {
    expect(isValidTraceparent(`00-${validTraceId}-${validSpanId}-01`)).toBe(true);
  });

  it('accepts flags=00 (not sampled)', () => {
    expect(isValidTraceparent(`00-${validTraceId}-${validSpanId}-00`)).toBe(true);
  });

  it('rejects wrong version', () => {
    expect(isValidTraceparent(`01-${validTraceId}-${validSpanId}-01`)).toBe(false);
  });

  it('rejects traceId that is too short', () => {
    expect(isValidTraceparent(`00-a1b2c3d4-${validSpanId}-01`)).toBe(false);
  });

  it('rejects spanId that is too short', () => {
    expect(isValidTraceparent(`00-${validTraceId}-a1b2c3d4-01`)).toBe(false);
  });

  it('rejects uppercase hex', () => {
    const uppercaseTraceId = validTraceId.toUpperCase();
    expect(isValidTraceparent(`00-${uppercaseTraceId}-${validSpanId}-01`)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidTraceparent('')).toBe(false);
  });

  it('rejects missing separators', () => {
    expect(isValidTraceparent(`00${validTraceId}${validSpanId}01`)).toBe(false);
  });
});

describe('parseTraceparent', () => {
  it('parses a valid traceparent into components', () => {
    const result = parseTraceparent(`00-${validTraceId}-${validSpanId}-01`);
    expect(result).not.toBeNull();
    expect(result!.traceId).toBe(validTraceId);
    expect(result!.spanId).toBe(validSpanId);
    expect(result!.traceFlags).toBe(1);
  });

  it('parses flags=00 as traceFlags=0', () => {
    const result = parseTraceparent(`00-${validTraceId}-${validSpanId}-00`);
    expect(result!.traceFlags).toBe(0);
  });

  it('returns null for invalid traceparent', () => {
    expect(parseTraceparent('invalid')).toBeNull();
  });

  it('round-trips through format then parse', () => {
    const original = { traceId: validTraceId, spanId: validSpanId, traceFlags: 1 };
    const header = formatTraceparent(original);
    const parsed = parseTraceparent(header);
    expect(parsed).toEqual(original);
  });
});
