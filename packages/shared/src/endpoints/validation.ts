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

// IP validation regex patterns
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX =
  /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:$|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})$|^:((:[0-9a-fA-F]{1,4}){1,7}|:)$/;
const CIDR_IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
const CIDR_IPV6_REGEX =
  /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\/\d{1,3}$|^([0-9a-fA-F]{1,4}:){1,7}:[0-9a-fA-F]{1,4}\/\d{1,3}$/;

function isValidIPv4(ip: string): boolean {
  if (!IPV4_REGEX.test(ip)) return false;
  const parts = ip.split('.').map(Number);
  return parts.every((part) => part >= 0 && part <= 255);
}

function isValidIPv6(ip: string): boolean {
  return IPV6_REGEX.test(ip);
}

function isValidCIDR(cidr: string): boolean {
  if (CIDR_IPV4_REGEX.test(cidr)) {
    const parts = cidr.split('/');
    const ip = parts[0] ?? '';
    const prefix = parts[1] ?? '';
    const prefixNum = Number.parseInt(prefix, 10);
    return isValidIPv4(ip) && prefixNum >= 0 && prefixNum <= 32;
  }
  if (CIDR_IPV6_REGEX.test(cidr)) {
    const parts = cidr.split('/');
    const ip = parts[0] ?? '';
    const prefix = parts[1] ?? '';
    const prefixNum = Number.parseInt(prefix, 10);
    return isValidIPv6(ip) && prefixNum >= 0 && prefixNum <= 128;
  }
  return false;
}

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

export function validateIpWhitelist(ips: string[] | undefined): ValidationResult {
  if (!ips || ips.length === 0) {
    return { valid: true };
  }

  // Max 50 IPs
  if (ips.length > 50) {
    return { valid: false, error: 'Maximum 50 IP addresses allowed' };
  }

  for (const ip of ips) {
    const trimmed = ip.trim();
    if (!isValidIPv4(trimmed) && !isValidIPv6(trimmed) && !isValidCIDR(trimmed)) {
      return { valid: false, error: `Invalid IP address or CIDR: ${ip}` };
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
  ipWhitelist: z.array(z.string()).optional(),
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
  ipWhitelist: z.array(z.string()).optional().nullable(),
});

export type EndpointCreateInput = z.infer<typeof endpointCreateSchema>;
export type EndpointUpdateInput = z.infer<typeof endpointUpdateSchema>;
