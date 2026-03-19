/**
 * Zod schemas for endpoint input validation
 */

import { z } from 'zod';

// Validation helper: check if header name is valid HTTP header
const validHeaderNameRegex = /^[a-zA-Z][a-zA-Z0-9-]*$/;

// Reserved headers that cannot be overridden
const RESERVED_HEADERS = [
  'authorization',
  'host',
  'content-type',
  'content-length',
  'connection',
  'x-hookwing-signature',
  'x-hookwing-event',
  'x-hookwing-delivery-id',
  'x-hookwing-attempt',
];

export type ValidationResult = { valid: true } | { valid: false; error: string };

export function validateCustomHeaders(
  headers: Record<string, string> | undefined,
): ValidationResult {
  if (!headers || Object.keys(headers).length === 0) {
    return { valid: true };
  }

  // Max 10 headers
  if (Object.keys(headers).length > 10) {
    return { valid: false, error: 'Maximum 10 custom headers allowed' };
  }

  for (const [name, value] of Object.entries(headers)) {
    // Check for reserved headers
    const lowerName = name.toLowerCase();
    if (RESERVED_HEADERS.includes(lowerName)) {
      return { valid: false, error: `Reserved header '${name}' cannot be overridden` };
    }

    // Check header name format
    if (!validHeaderNameRegex.test(name)) {
      return { valid: false, error: `Invalid header name '${name}'` };
    }

    // Check header value is not empty
    if (!value || value.trim() === '') {
      return { valid: false, error: `Header '${name}' value cannot be empty` };
    }
  }

  return { valid: true };
}

export const endpointCreateSchema = z.object({
  url: z
    .string()
    .url()
    .refine((url) => url.startsWith('https://'), { message: 'Endpoint URL must use HTTPS' }),
  description: z.string().max(500).optional(),
  eventTypes: z.array(z.string().min(1)).optional(), // null = subscribe to all
  fanoutEnabled: z.boolean().optional().default(true), // Opt-out of receiving fan-out events
  metadata: z.record(z.string()).optional(),
  customHeaders: z.record(z.string()).optional(),
});

export const endpointUpdateSchema = z.object({
  url: z
    .string()
    .url()
    .refine((url) => url.startsWith('https://'), { message: 'Endpoint URL must use HTTPS' })
    .optional(),
  description: z.string().max(500).optional().nullable(),
  eventTypes: z.array(z.string().min(1)).optional().nullable(),
  isActive: z.boolean().optional(),
  fanoutEnabled: z.boolean().optional(),
  metadata: z.record(z.string()).optional().nullable(),
  customHeaders: z.record(z.string()).optional().nullable(),
});

export type EndpointCreateInput = z.infer<typeof endpointCreateSchema>;
export type EndpointUpdateInput = z.infer<typeof endpointUpdateSchema>;
