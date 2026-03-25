/**
 * Tests for Routing Rules, Condition Evaluation, and Transforms
 */

import { describe, expect, it } from 'vitest';
import { createRuleSchema, testRuleSchema } from '../routes/routing-rules';
import { type Condition, type EventContext, evaluateConditions } from '../services/rule-engine';
import { type TransformConfig, applyTransform } from '../services/transforms';

// ============================================================================
// Schemas
// ============================================================================

describe('createRuleSchema', () => {
  it('should accept valid rule', () => {
    const result = createRuleSchema.safeParse({
      name: 'High-value orders',
      priority: 10,
      conditions: [
        { field: 'event.type', operator: 'equals', value: 'order.created' },
        { field: '$.payload.amount', operator: 'gt', value: 100 },
      ],
      action: {
        type: 'deliver',
        endpointId: 'ep_test123',
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept rule with transform', () => {
    const result = createRuleSchema.safeParse({
      name: 'Extract fields',
      conditions: [{ field: 'event.type', operator: 'equals', value: 'order.created' }],
      action: {
        type: 'deliver',
        endpointId: 'ep_test123',
        transform: {
          type: 'extract',
          config: { fields: ['order_id', 'amount'] },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject rule without conditions', () => {
    const result = createRuleSchema.safeParse({
      name: 'No conditions',
      conditions: [],
      action: { type: 'deliver' },
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid operator', () => {
    const result = createRuleSchema.safeParse({
      name: 'Invalid operator',
      conditions: [{ field: 'event.type', operator: 'invalid' as 'equals', value: 'test' }],
      action: { type: 'deliver' },
    });
    expect(result.success).toBe(false);
  });
});

describe('testRuleSchema', () => {
  it('should accept valid test input', () => {
    const result = testRuleSchema.safeParse({
      event: {
        type: 'order.created',
        payload: { amount: 150 },
        headers: { 'X-Source': 'api' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept test input without optional fields', () => {
    const result = testRuleSchema.safeParse({
      event: {
        type: 'order.created',
      },
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Condition Evaluation
// ============================================================================

describe('evaluateConditions', () => {
  const baseEvent: EventContext = {
    type: 'order.created',
    payload: {
      amount: 150,
      email: 'test@example.com',
      user: { name: 'John', role: 'admin' },
      tags: ['vip', 'new'],
    },
    headers: {
      'X-Source': 'api',
      'X-Custom': 'value',
    },
  };

  it('should evaluate equals operator', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'equals', value: 'order.created' },
    ];
    expect(evaluateConditions(conditions, baseEvent)).toBe(true);

    const conditions2: Condition[] = [
      { field: 'event.type', operator: 'equals', value: 'order.updated' },
    ];
    expect(evaluateConditions(conditions2, baseEvent)).toBe(false);
  });

  it('should evaluate not_equals operator', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'not_equals', value: 'order.updated' },
    ];
    expect(evaluateConditions(conditions, baseEvent)).toBe(true);
  });

  it('should evaluate contains operator', () => {
    const conditions: Condition[] = [
      { field: '$.payload.email', operator: 'contains', value: '@example.com' },
    ];
    expect(evaluateConditions(conditions, baseEvent)).toBe(true);

    const conditions2: Condition[] = [
      { field: '$.payload.email', operator: 'contains', value: '@other.com' },
    ];
    expect(evaluateConditions(conditions2, baseEvent)).toBe(false);
  });

  it('should evaluate starts_with operator', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'starts_with', value: 'order.' },
    ];
    expect(evaluateConditions(conditions, baseEvent)).toBe(true);
  });

  it('should evaluate gt operator', () => {
    const conditions: Condition[] = [{ field: '$.payload.amount', operator: 'gt', value: 100 }];
    expect(evaluateConditions(conditions, baseEvent)).toBe(true);

    const conditions2: Condition[] = [{ field: '$.payload.amount', operator: 'gt', value: 200 }];
    expect(evaluateConditions(conditions2, baseEvent)).toBe(false);
  });

  it('should evaluate gte operator', () => {
    const conditions: Condition[] = [{ field: '$.payload.amount', operator: 'gte', value: 150 }];
    expect(evaluateConditions(conditions, baseEvent)).toBe(true);

    const conditions2: Condition[] = [{ field: '$.payload.amount', operator: 'gte', value: 151 }];
    expect(evaluateConditions(conditions2, baseEvent)).toBe(false);
  });

  it('should evaluate lt operator', () => {
    const conditions: Condition[] = [{ field: '$.payload.amount', operator: 'lt', value: 200 }];
    expect(evaluateConditions(conditions, baseEvent)).toBe(true);
  });

  it('should evaluate lte operator', () => {
    const conditions: Condition[] = [{ field: '$.payload.amount', operator: 'lte', value: 150 }];
    expect(evaluateConditions(conditions, baseEvent)).toBe(true);
  });

  it('should evaluate exists operator', () => {
    const conditions: Condition[] = [
      { field: '$.payload.amount', operator: 'exists', value: true },
    ];
    expect(evaluateConditions(conditions, baseEvent)).toBe(true);

    const conditions2: Condition[] = [
      { field: '$.payload.missing', operator: 'exists', value: true },
    ];
    expect(evaluateConditions(conditions2, baseEvent)).toBe(false);

    const conditions3: Condition[] = [
      { field: '$.payload.missing', operator: 'exists', value: false },
    ];
    expect(evaluateConditions(conditions3, baseEvent)).toBe(true);
  });

  it('should evaluate in operator', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'in', value: ['order.created', 'order.updated'] },
    ];
    expect(evaluateConditions(conditions, baseEvent)).toBe(true);

    const conditions2: Condition[] = [
      { field: 'event.type', operator: 'in', value: ['payment.succeeded'] },
    ];
    expect(evaluateConditions(conditions2, baseEvent)).toBe(false);
  });

  it('should evaluate regex operator', () => {
    const conditions: Condition[] = [
      { field: '$.payload.email', operator: 'regex', value: '^\\w+@example\\.com$' },
    ];
    expect(evaluateConditions(conditions, baseEvent)).toBe(true);
  });

  it('should evaluate header conditions', () => {
    const conditions: Condition[] = [
      { field: 'headers.X-Source', operator: 'equals', value: 'api' },
    ];
    expect(evaluateConditions(conditions, baseEvent)).toBe(true);
  });

  it('should evaluate nested JSON path', () => {
    const conditions: Condition[] = [
      { field: '$.payload.user.role', operator: 'equals', value: 'admin' },
    ];
    expect(evaluateConditions(conditions, baseEvent)).toBe(true);
  });

  it('should require all conditions to match (AND logic)', () => {
    const conditions: Condition[] = [
      { field: 'event.type', operator: 'equals', value: 'order.created' },
      { field: '$.payload.amount', operator: 'gt', value: 100 },
    ];
    expect(evaluateConditions(conditions, baseEvent)).toBe(true);

    const conditions2: Condition[] = [
      { field: 'event.type', operator: 'equals', value: 'order.created' },
      { field: '$.payload.amount', operator: 'gt', value: 200 },
    ];
    expect(evaluateConditions(conditions2, baseEvent)).toBe(false);
  });
});

// ============================================================================
// Transforms
// ============================================================================

describe('applyTransform', () => {
  const payload = {
    order_id: 'ord_123',
    amount: 150,
    customer_email: 'test@example.com',
    user: { name: 'John', role: 'admin' },
  };

  it('should apply extract transform', () => {
    const transform: TransformConfig = {
      type: 'extract',
      config: { fields: ['order_id', 'amount'] },
    };
    const result = applyTransform(payload, transform);
    expect(result).toEqual({ order_id: 'ord_123', amount: 150 });
  });

  it('should apply rename transform', () => {
    const transform: TransformConfig = {
      type: 'rename',
      config: { mapping: { order_id: 'id', customer_email: 'email' } },
    };
    const result = applyTransform(payload, transform);
    expect(result).toEqual({
      id: 'ord_123',
      amount: 150,
      email: 'test@example.com',
      user: { name: 'John', role: 'admin' },
    });
  });

  it('should apply template transform', () => {
    const transform: TransformConfig = {
      type: 'template',
      config: { template: 'Order {{order_id}} for {{amount}}' },
    };
    const result = applyTransform(payload, transform);
    expect(result).toBe('Order ord_123 for 150');
  });

  it('should handle missing fields in template', () => {
    const transform: TransformConfig = {
      type: 'template',
      config: { template: 'Order {{order_id}} for {{missing_field}}' },
    };
    const result = applyTransform(payload, transform);
    expect(result).toBe('Order ord_123 for ');
  });

  it('should return original payload for unknown transform type', () => {
    const transform: TransformConfig = {
      type: 'unknown' as 'extract',
      config: {},
    };
    const result = applyTransform(payload, transform);
    expect(result).toEqual(payload);
  });

  it('should handle non-object payloads', () => {
    const transform: TransformConfig = {
      type: 'extract',
      config: { fields: ['field'] },
    };
    expect(applyTransform('string payload', transform)).toBe('string payload');
    expect(applyTransform(null, transform)).toBe(null);
  });
});
