/**
 * Rule Engine — Condition Evaluation for Event Routing
 */

export interface Condition {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'starts_with'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'exists'
    | 'in'
    | 'regex';
  value: unknown;
}

export interface EventContext {
  type: string;
  payload: unknown;
  headers: Record<string, string>;
}

/**
 * Evaluate all conditions against an event — all must match (AND logic)
 */
export function evaluateConditions(conditions: Condition[], event: EventContext): boolean {
  return conditions.every((condition) => evaluateCondition(condition, event));
}

/**
 * Evaluate a single condition against an event
 */
function evaluateCondition(condition: Condition, event: EventContext): boolean {
  const value = resolveField(condition.field, event);

  switch (condition.operator) {
    case 'equals':
      return value === condition.value;

    case 'not_equals':
      return value !== condition.value;

    case 'contains':
      return String(value).includes(String(condition.value));

    case 'starts_with':
      return String(value).startsWith(String(condition.value));

    case 'gt':
      return Number(value) > Number(condition.value);

    case 'gte':
      return Number(value) >= Number(condition.value);

    case 'lt':
      return Number(value) < Number(condition.value);

    case 'lte':
      return Number(value) <= Number(condition.value);

    case 'exists': {
      const shouldExist = Boolean(condition.value);
      const exists = value !== undefined && value !== null;
      return exists === shouldExist;
    }

    case 'in':
      if (!Array.isArray(condition.value)) {
        return false;
      }
      return condition.value.includes(value);

    case 'regex':
      try {
        return new RegExp(String(condition.value)).test(String(value));
      } catch {
        return false;
      }

    default:
      return false;
  }
}

/**
 * Resolve a field path to its value in the event context
 */
function resolveField(field: string, event: EventContext): unknown {
  // Direct event type field
  if (field === 'event.type') {
    return event.type;
  }

  // Headers field (e.g., headers.X-Source)
  if (field.startsWith('headers.')) {
    const headerName = field.slice(8);
    return event.headers[headerName];
  }

  // JSON path into payload (e.g., $.payload.amount or $.payload.user.name)
  if (field.startsWith('$.payload.')) {
    const path = field.slice(10).split('.');
    let current: unknown = event.payload;
    for (const key of path) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return current;
  }

  // Also support $.headers.* for consistency
  if (field.startsWith('$.headers.')) {
    const headerName = field.slice(10);
    return event.headers[headerName];
  }

  return undefined;
}
