import { describe, expect, it } from 'vitest';
import {
  createChildSpan,
  generateTraceparent,
  parseTraceparent,
  parseTracestate,
  serializeTracestate,
} from '../shared/tracing';

describe('parseTraceparent', () => {
  it('should parse a valid traceparent header', () => {
    const result = parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    expect(result).not.toBeNull();
    expect(result!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(result!.spanId).toBe('00f067aa0ba902b7');
    expect(result!.traceFlags).toBe(1);
  });

  it('should parse traceparent with traceFlags 00', () => {
    const result = parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00');
    expect(result).not.toBeNull();
    expect(result!.traceFlags).toBe(0);
  });

  it('should return null for invalid format', () => {
    expect(parseTraceparent('invalid')).toBeNull();
    expect(parseTraceparent('')).toBeNull();
    expect(parseTraceparent('00-abc-def-01')).toBeNull();
  });

  it('should return null for wrong version prefix', () => {
    expect(parseTraceparent('01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')).toBeNull();
  });

  it('should return null for invalid hex characters', () => {
    expect(parseTraceparent('00-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-00f067aa0ba902b7-01')).toBeNull();
  });

  it('should return null for all-zero traceId', () => {
    expect(parseTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-01')).toBeNull();
  });

  it('should return null for all-zero spanId', () => {
    expect(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01')).toBeNull();
  });

  it('should handle leading/trailing whitespace', () => {
    const result = parseTraceparent('  00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01  ');
    expect(result).not.toBeNull();
    expect(result!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  });
});

describe('generateTraceparent', () => {
  it('should return valid format', () => {
    const result = generateTraceparent();
    expect(result.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(result.traceId).toHaveLength(32);
    expect(result.spanId).toHaveLength(16);
  });

  it('should return unique values on each call', () => {
    const a = generateTraceparent();
    const b = generateTraceparent();
    expect(a.traceId).not.toBe(b.traceId);
    expect(a.spanId).not.toBe(b.spanId);
  });

  it('should be parseable by parseTraceparent', () => {
    const generated = generateTraceparent();
    const parsed = parseTraceparent(generated.traceparent);
    expect(parsed).not.toBeNull();
    expect(parsed!.traceId).toBe(generated.traceId);
    expect(parsed!.spanId).toBe(generated.spanId);
  });
});

describe('createChildSpan', () => {
  it('should preserve traceId but change spanId', () => {
    const parent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const child = createChildSpan(parent);
    expect(child).not.toBeNull();
    expect(child!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(child!.spanId).not.toBe('00f067aa0ba902b7');
    expect(child!.spanId).toHaveLength(16);
  });

  it('should return null for invalid parent', () => {
    expect(createChildSpan('invalid')).toBeNull();
  });

  it('should return a parseable traceparent', () => {
    const parent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const child = createChildSpan(parent);
    expect(child).not.toBeNull();
    const parsed = parseTraceparent(child!.traceparent);
    expect(parsed).not.toBeNull();
    expect(parsed!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  });
});

describe('parseTracestate', () => {
  it('should parse single key-value pair', () => {
    const result = parseTracestate('vendor1=value1');
    expect(result.size).toBe(1);
    expect(result.get('vendor1')).toBe('value1');
  });

  it('should parse multiple key-value pairs', () => {
    const result = parseTracestate('vendor1=value1,vendor2=value2');
    expect(result.size).toBe(2);
    expect(result.get('vendor1')).toBe('value1');
    expect(result.get('vendor2')).toBe('value2');
  });

  it('should handle empty string', () => {
    const result = parseTracestate('');
    expect(result.size).toBe(0);
  });

  it('should handle whitespace', () => {
    const result = parseTracestate('  vendor1=value1 , vendor2=value2  ');
    expect(result.size).toBe(2);
    expect(result.get('vendor1')).toBe('value1');
    expect(result.get('vendor2')).toBe('value2');
  });

  it('should skip entries without equals sign', () => {
    const result = parseTracestate('vendor1=value1,invalid,vendor2=value2');
    expect(result.size).toBe(2);
  });
});

describe('serializeTracestate', () => {
  it('should serialize a map to header string', () => {
    const state = new Map([
      ['vendor1', 'value1'],
      ['vendor2', 'value2'],
    ]);
    const result = serializeTracestate(state);
    expect(result).toBe('vendor1=value1,vendor2=value2');
  });

  it('should serialize empty map to empty string', () => {
    const result = serializeTracestate(new Map());
    expect(result).toBe('');
  });

  it('should round-trip correctly', () => {
    const original = 'vendor1=value1,vendor2=value2';
    const parsed = parseTracestate(original);
    const serialized = serializeTracestate(parsed);
    expect(serialized).toBe(original);
  });
});
