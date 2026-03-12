/**
 * Zod schemas for endpoint input validation
 */

import { z } from 'zod';

export const endpointCreateSchema = z.object({
  url: z
    .string()
    .url()
    .refine((url) => url.startsWith('https://'), { message: 'Endpoint URL must use HTTPS' }),
  description: z.string().max(500).optional(),
  eventTypes: z.array(z.string().min(1)).optional(), // null = subscribe to all
  metadata: z.record(z.string()).optional(),
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
  metadata: z.record(z.string()).optional().nullable(),
});

export type EndpointCreateInput = z.infer<typeof endpointCreateSchema>;
export type EndpointUpdateInput = z.infer<typeof endpointUpdateSchema>;
