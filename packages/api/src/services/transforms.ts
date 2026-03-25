/**
 * Transform Engine — Payload Transformations for Event Routing
 */

export interface TransformConfig {
  type: 'extract' | 'rename' | 'template';
  config: Record<string, unknown>;
}

/**
 * Apply a transformation to a payload
 */
export function applyTransform(payload: unknown, transform: TransformConfig): unknown {
  if (typeof payload !== 'object' || payload === null) {
    return payload;
  }

  switch (transform.type) {
    case 'extract':
      return applyExtract(payload, transform.config);

    case 'rename':
      return applyRename(payload, transform.config);

    case 'template':
      return applyTemplate(payload, transform.config);

    default:
      return payload;
  }
}

/**
 * Extract — extract specific fields from payload
 * config: { fields: ["order_id", "amount", "customer_email"] }
 */
function applyExtract(payload: unknown, config: Record<string, unknown>): Record<string, unknown> {
  const fields = config.fields as string[];
  if (!Array.isArray(fields)) {
    return payload as Record<string, unknown>;
  }

  const result: Record<string, unknown> = {};
  for (const field of fields) {
    result[field] = resolveJsonPath(payload, field);
  }
  return result;
}

/**
 * Rename — rename keys in payload
 * config: { mapping: { old_key: "new_key", ... } }
 */
function applyRename(payload: unknown, config: Record<string, unknown>): Record<string, unknown> {
  const mapping = config.mapping as Record<string, string>;
  if (typeof mapping !== 'object' || mapping === null) {
    return payload as Record<string, unknown>;
  }

  const original = payload as Record<string, unknown>;
  const renamed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(original)) {
    const newKey = mapping[key] ?? key;
    renamed[newKey] = value;
  }

  return renamed;
}

/**
 * Template — apply string template with variable substitution
 * config: { template: "Order {{order_id}} for {{amount}}" }
 */
function applyTemplate(payload: unknown, config: Record<string, unknown>): unknown {
  const template = config.template as string;
  if (typeof template !== 'string') {
    return payload;
  }

  const original = payload as Record<string, unknown>;

  // Replace {{field}} with values
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = original[key];
    return value !== undefined ? String(value) : '';
  });
}

/**
 * Resolve a JSON path (simple dot notation) from a payload
 */
function resolveJsonPath(payload: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = payload;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}
