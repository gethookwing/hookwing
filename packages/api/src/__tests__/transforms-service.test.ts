/**
 * Comprehensive tests for the Transform service
 *
 * Covers: applyTransform, extract, rename, template, resolveJsonPath edge cases
 */

import { describe, expect, it } from 'vitest';
import { type TransformConfig, applyTransform } from '../services/transforms';

// ============================================================================
// Extract transform
// ============================================================================

describe('applyTransform — extract', () => {
  it('should extract specified fields from a flat object', () => {
    const payload = { order_id: 'ord_1', amount: 99.99, email: 'user@example.com', secret: 'xxx' };
    const transform: TransformConfig = {
      type: 'extract',
      config: { fields: ['order_id', 'amount'] },
    };
    const result = applyTransform(payload, transform) as Record<string, unknown>;
    expect(result).toEqual({ order_id: 'ord_1', amount: 99.99 });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('secret');
  });

  it('should extract a single field', () => {
    const payload = { a: 1, b: 2, c: 3 };
    const transform: TransformConfig = { type: 'extract', config: { fields: ['b'] } };
    expect(applyTransform(payload, transform)).toEqual({ b: 2 });
  });

  it('should return empty object when extracting non-existent fields', () => {
    const payload = { a: 1 };
    const transform: TransformConfig = {
      type: 'extract',
      config: { fields: ['non_existent'] },
    };
    const result = applyTransform(payload, transform) as Record<string, unknown>;
    expect(result).toEqual({ non_existent: undefined });
  });

  it('should handle nested field extraction via dot notation', () => {
    const payload = { user: { id: 42, name: 'Alice' }, order: { total: 100 } };
    const transform: TransformConfig = {
      type: 'extract',
      config: { fields: ['user.id'] },
    };
    const result = applyTransform(payload, transform) as Record<string, unknown>;
    expect(result['user.id']).toBe(42);
  });

  it('should return payload as-is when fields is not an array', () => {
    const payload = { a: 1 };
    const transform: TransformConfig = {
      type: 'extract',
      config: { fields: 'not_an_array' },
    };
    const result = applyTransform(payload, transform);
    expect(result).toEqual({ a: 1 });
  });

  it('should handle empty fields array', () => {
    const payload = { a: 1, b: 2 };
    const transform: TransformConfig = { type: 'extract', config: { fields: [] } };
    expect(applyTransform(payload, transform)).toEqual({});
  });

  it('should return null payload as-is', () => {
    const transform: TransformConfig = { type: 'extract', config: { fields: ['a'] } };
    expect(applyTransform(null, transform)).toBe(null);
  });

  it('should return string payload as-is', () => {
    const transform: TransformConfig = { type: 'extract', config: { fields: ['a'] } };
    expect(applyTransform('string payload', transform)).toBe('string payload');
  });

  it('should return number payload as-is', () => {
    const transform: TransformConfig = { type: 'extract', config: { fields: ['a'] } };
    expect(applyTransform(42, transform)).toBe(42);
  });
});

// ============================================================================
// Rename transform
// ============================================================================

describe('applyTransform — rename', () => {
  it('should rename keys according to the mapping', () => {
    const payload = { order_id: 'ord_1', user_email: 'test@example.com', amount: 50 };
    const transform: TransformConfig = {
      type: 'rename',
      config: { mapping: { order_id: 'id', user_email: 'email' } },
    };
    const result = applyTransform(payload, transform) as Record<string, unknown>;
    expect(result).toHaveProperty('id', 'ord_1');
    expect(result).toHaveProperty('email', 'test@example.com');
    expect(result).toHaveProperty('amount', 50);
    expect(result).not.toHaveProperty('order_id');
    expect(result).not.toHaveProperty('user_email');
  });

  it('should keep keys not present in the mapping unchanged', () => {
    const payload = { a: 1, b: 2, c: 3 };
    const transform: TransformConfig = {
      type: 'rename',
      config: { mapping: { a: 'alpha' } },
    };
    const result = applyTransform(payload, transform) as Record<string, unknown>;
    expect(result).toHaveProperty('alpha', 1);
    expect(result).toHaveProperty('b', 2);
    expect(result).toHaveProperty('c', 3);
    expect(result).not.toHaveProperty('a');
  });

  it('should handle empty mapping (return identical object)', () => {
    const payload = { x: 10, y: 20 };
    const transform: TransformConfig = { type: 'rename', config: { mapping: {} } };
    expect(applyTransform(payload, transform)).toEqual({ x: 10, y: 20 });
  });

  it('should return payload as-is when mapping is null', () => {
    const payload = { a: 1 };
    const transform: TransformConfig = { type: 'rename', config: { mapping: null } };
    expect(applyTransform(payload, transform)).toEqual({ a: 1 });
  });

  it('should return payload as-is when mapping is not an object', () => {
    const payload = { a: 1 };
    const transform: TransformConfig = { type: 'rename', config: { mapping: 'not_object' } };
    expect(applyTransform(payload, transform)).toEqual({ a: 1 });
  });

  it('should handle renaming all keys', () => {
    const payload = { foo: 'bar', baz: 'qux' };
    const transform: TransformConfig = {
      type: 'rename',
      config: { mapping: { foo: 'a', baz: 'b' } },
    };
    const result = applyTransform(payload, transform) as Record<string, unknown>;
    expect(result).toEqual({ a: 'bar', b: 'qux' });
  });

  it('should handle null payload', () => {
    const transform: TransformConfig = {
      type: 'rename',
      config: { mapping: { a: 'b' } },
    };
    expect(applyTransform(null, transform)).toBe(null);
  });

  it('should handle number values in payload', () => {
    const payload = { count: 42, label: 'test' };
    const transform: TransformConfig = {
      type: 'rename',
      config: { mapping: { count: 'total' } },
    };
    const result = applyTransform(payload, transform) as Record<string, unknown>;
    expect(result).toEqual({ total: 42, label: 'test' });
  });
});

// ============================================================================
// Template transform
// ============================================================================

describe('applyTransform — template', () => {
  it('should substitute {{field}} placeholders', () => {
    const payload = { order_id: 'ord_1', amount: 99 };
    const transform: TransformConfig = {
      type: 'template',
      config: { template: 'Order {{order_id}} for ${{amount}}' },
    };
    expect(applyTransform(payload, transform)).toBe('Order ord_1 for $99');
  });

  it('should replace missing fields with empty string', () => {
    const payload = { order_id: 'ord_1' };
    const transform: TransformConfig = {
      type: 'template',
      config: { template: 'Order {{order_id}} for {{missing}}' },
    };
    expect(applyTransform(payload, transform)).toBe('Order ord_1 for ');
  });

  it('should handle template with no placeholders', () => {
    const payload = { order_id: 'ord_1' };
    const transform: TransformConfig = {
      type: 'template',
      config: { template: 'No placeholders here' },
    };
    expect(applyTransform(payload, transform)).toBe('No placeholders here');
  });

  it('should handle multiple occurrences of the same placeholder', () => {
    const payload = { name: 'Alice' };
    const transform: TransformConfig = {
      type: 'template',
      config: { template: 'Hello {{name}}, welcome {{name}}!' },
    };
    expect(applyTransform(payload, transform)).toBe('Hello Alice, welcome Alice!');
  });

  it('should return payload unchanged when template is not a string', () => {
    const payload = { a: 1 };
    const transform: TransformConfig = {
      type: 'template',
      config: { template: 42 },
    };
    expect(applyTransform(payload, transform)).toEqual({ a: 1 });
  });

  it('should handle empty template string', () => {
    const payload = { a: 1 };
    const transform: TransformConfig = {
      type: 'template',
      config: { template: '' },
    };
    expect(applyTransform(payload, transform)).toBe('');
  });

  it('should handle boolean field values', () => {
    const payload = { active: true };
    const transform: TransformConfig = {
      type: 'template',
      config: { template: 'Status: {{active}}' },
    };
    expect(applyTransform(payload, transform)).toBe('Status: true');
  });

  it('should handle null payload', () => {
    const transform: TransformConfig = {
      type: 'template',
      config: { template: 'Hello {{name}}' },
    };
    expect(applyTransform(null, transform)).toBe(null);
  });
});

// ============================================================================
// Unknown transform type
// ============================================================================

describe('applyTransform — unknown type', () => {
  it('should return payload unchanged for unknown transform type', () => {
    const payload = { a: 1 };
    const transform = { type: 'unknown' as 'extract', config: {} };
    expect(applyTransform(payload, transform)).toEqual({ a: 1 });
  });
});
