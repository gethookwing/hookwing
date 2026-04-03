/**
 * Edge case tests for the Rule Engine service
 *
 * Extends basic coverage in routing-rules.test.ts with boundary conditions,
 * type coercion, regex edge cases, and multi-condition AND logic.
 */

import { describe, expect, it } from 'vitest';
import { type Condition, type EventContext, evaluateConditions } from '../services/rule-engine';

function makeEvent(overrides: Partial<EventContext> = {}): EventContext {
  return {
    type: 'order.created',
    payload: { amount: 100, customer: { email: 'test@example.com', tier: 'gold' }, code: 200 },
    headers: { 'x-source': 'shopify', 'content-type': 'application/json' },
    ...overrides,
  };
}

// ============================================================================
// AND logic — all conditions must match
// ============================================================================

describe('evaluateConditions — AND logic', () => {
  it('should return true when all conditions match', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'equals', value: 'order.created' },
      { field: '$.payload.amount', operator:'gt', value: 50 },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('should return false when any one condition fails', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'equals', value: 'order.created' },
      { field: '$.payload.amount', operator:'gt', value: 200 }, // fails: 100 > 200 is false
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });

  it('should return false when first condition fails (short-circuit)', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'equals', value: 'order.deleted' }, // fails
      { field: '$.payload.amount', operator:'gt', value: 50 },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });

  it('should return true for empty conditions array', () => {
    expect(evaluateConditions([], makeEvent())).toBe(true);
  });

  it('should handle three conditions all passing', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'starts_with', value: 'order' },
      { field: '$.payload.amount', operator:'gte', value: 100 },
      { field: 'headers.x-source', operator: 'equals', value: 'shopify' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });
});

// ============================================================================
// Numeric comparison operators with type coercion
// ============================================================================

describe('evaluateConditions — numeric operators', () => {
  it('gt: should return false when field value equals threshold', () => {
    const conditions: Condition[] = [{ field: '$.payload.amount', operator:'gt', value: 100 }];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });

  it('gte: should return true when field value equals threshold', () => {
    const conditions: Condition[] = [{ field: '$.payload.amount', operator:'gte', value: 100 }];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('lt: should return false when field value equals threshold', () => {
    const conditions: Condition[] = [{ field: '$.payload.amount', operator:'lt', value: 100 }];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });

  it('lte: should return true when field value equals threshold', () => {
    const conditions: Condition[] = [{ field: '$.payload.amount', operator:'lte', value: 100 }];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('gt: should return true for strictly greater value', () => {
    const conditions: Condition[] = [{ field: '$.payload.amount', operator:'gt', value: 99 }];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('lt: should return true for strictly less value', () => {
    const conditions: Condition[] = [{ field: '$.payload.amount', operator:'lt', value: 101 }];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('should handle negative threshold', () => {
    const conditions: Condition[] = [{ field: '$.payload.amount', operator:'gt', value: -1 }];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });
});

// ============================================================================
// String operators
// ============================================================================

describe('evaluateConditions — string operators', () => {
  it('contains: should return true when substring is present', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'contains', value: 'created' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('contains: should return false when substring is absent', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'contains', value: 'deleted' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });

  it('starts_with: should return true when prefix matches', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'starts_with', value: 'order.' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('starts_with: should return false when prefix does not match', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'starts_with', value: 'invoice.' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });

  it('not_equals: should return true when values differ', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'not_equals', value: 'order.deleted' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('not_equals: should return false when values match', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'not_equals', value: 'order.created' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });
});

// ============================================================================
// exists operator
// ============================================================================

describe('evaluateConditions — exists operator', () => {
  it('should return true when field exists and condition expects it to', () => {
    const conditions: Condition[] = [{ field: '$.payload.amount', operator:'exists', value: true }];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('should return false when field exists but condition expects it not to', () => {
    const conditions: Condition[] = [{ field: '$.payload.amount', operator:'exists', value: false }];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });

  it('should return true when field does not exist and condition expects absence', () => {
    const conditions: Condition[] = [
      { field: '$.payload.nonexistent_field', operator:'exists', value: false },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('should return false when field does not exist but condition expects presence', () => {
    const conditions: Condition[] = [
      { field: '$.payload.nonexistent_field', operator:'exists', value: true },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });
});

// ============================================================================
// in operator
// ============================================================================

describe('evaluateConditions — in operator', () => {
  it('should return true when value is in the array', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'in', value: ['order.created', 'order.updated'] },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('should return false when value is not in the array', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'in', value: ['order.deleted', 'order.cancelled'] },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });

  it('should return false when value array is empty', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'in', value: [] },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });

  it('should return false when condition value is not an array', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'in', value: 'order.created' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });

  it('should work with numeric values in array', () => {
    const conditions: Condition[] = [
      { field: '$.payload.code', operator: 'in', value: [200, 201, 204] },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });
});

// ============================================================================
// regex operator
// ============================================================================

describe('evaluateConditions — regex operator', () => {
  it('should return true when value matches the regex', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'regex', value: '^order\\.' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('should return false when value does not match the regex', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'regex', value: '^invoice\\.' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });

  it('should return false for invalid regex pattern', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'regex', value: '[invalid(regex' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });

  it('should match case-sensitive by default', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'regex', value: 'ORDER' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });

  it('should match partial patterns', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'regex', value: 'creat' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });
});

// ============================================================================
// Header field resolution
// ============================================================================

describe('evaluateConditions — header field resolution', () => {
  it('should resolve headers.x-source field', () => {
    const conditions: Condition[] = [
      { field: 'headers.x-source', operator: 'equals', value: 'shopify' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('should return undefined for missing header', () => {
    const conditions: Condition[] = [
      { field: 'headers.x-missing-header', operator: 'exists', value: false },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('should handle case-sensitive header names', () => {
    const conditions: Condition[] = [
      { field: 'headers.X-Source', operator: 'equals', value: 'shopify' },
    ];
    // Headers are stored as lowercase in mock event; X-Source won't match x-source
    expect(evaluateConditions(conditions, makeEvent())).toBe(false);
  });
});

// ============================================================================
// Nested payload field resolution
// ============================================================================

describe('evaluateConditions — nested payload paths', () => {
  it('should resolve nested field via $.payload.customer.email', () => {
    const conditions: Condition[] = [
      { field: '$.payload.customer.email', operator: 'equals', value: 'test@example.com' },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('should return undefined for deeply missing path', () => {
    const conditions: Condition[] = [
      { field: '$.payload.customer.address.city', operator: 'exists', value: false },
    ];
    expect(evaluateConditions(conditions, makeEvent())).toBe(true);
  });

  it('should handle payload that is not an object', () => {
    const event = makeEvent({ payload: 'plain string' });
    const conditions: Condition[] = [
      { field: '$.payload.some_field', operator: 'exists', value: false },
    ];
    // When payload is a string, field resolution returns undefined
    expect(evaluateConditions(conditions, event)).toBe(true);
  });
});
