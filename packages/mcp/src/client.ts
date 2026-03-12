import { z } from 'zod';

const EndpointSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  url: z.string(),
  description: z.string().nullable().optional(),
  eventTypes: z.array(z.string()).nullable().optional(),
  isActive: z.boolean(),
  rateLimitPerSecond: z.number().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const DeliverySchema = z.object({
  id: z.string(),
  endpointId: z.string(),
  eventId: z.string(),
  attemptNumber: z.number(),
  status: z.enum(['pending', 'success', 'failed', 'retrying']),
  responseStatusCode: z.number().nullable().optional(),
  responseBody: z.string().nullable().optional(),
  responseHeaders: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  nextRetryAt: z.number().nullable().optional(),
  deliveredAt: z.number().nullable().optional(),
  createdAt: z.number(),
});

const EventSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  eventType: z.string(),
  payload: z.record(z.unknown()).nullable().optional(),
  headers: z.record(z.unknown()).nullable().optional(),
  sourceIp: z.string().nullable().optional(),
  receivedAt: z.number(),
  processedAt: z.number().nullable().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
});

const EventDetailSchema = EventSchema.extend({
  deliveries: z.array(DeliverySchema).optional(),
});

export type Endpoint = z.infer<typeof EndpointSchema>;
export type Delivery = z.infer<typeof DeliverySchema>;
export type Event = z.infer<typeof EventSchema>;
export type EventDetail = z.infer<typeof EventDetailSchema>;

export interface CreateEndpointInput {
  url: string;
  description?: string;
  eventTypes?: string[];
}

export interface ListEventsParams {
  limit?: number;
  cursor?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  event_type?: string;
}

export interface ListDeliveriesParams {
  limit?: number;
  offset?: number;
  status?: 'pending' | 'success' | 'failed' | 'retrying';
  endpointId?: string;
  eventId?: string;
}

export class HookwingClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.hookwing.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      let message = `Request failed: ${response.status} ${response.statusText}`;
      try {
        const errBody = (await response.json()) as { message?: string; error?: string };
        message = errBody.message ?? errBody.error ?? message;
      } catch {
        // keep default message
      }
      throw new Error(message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  async listEndpoints(): Promise<{ endpoints: Endpoint[] }> {
    const result = await this.request<{ endpoints: unknown[] }>('GET', '/v1/endpoints');
    return { endpoints: z.array(EndpointSchema).parse(result.endpoints) };
  }

  async createEndpoint(
    input: CreateEndpointInput,
  ): Promise<Endpoint & { secret: string | undefined }> {
    const body: Record<string, unknown> = { url: input.url };
    if (input.description !== undefined) body.description = input.description;
    if (input.eventTypes !== undefined) body.eventTypes = input.eventTypes;
    const result = await this.request<unknown>('POST', '/v1/endpoints', body);
    return EndpointSchema.extend({ secret: z.string().optional() }).parse(result) as Endpoint & {
      secret: string | undefined;
    };
  }

  async deleteEndpoint(id: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/endpoints/${id}`);
  }

  async listEvents(params: ListEventsParams): Promise<{ events: Event[]; pagination: unknown }> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.cursor !== undefined) qs.set('cursor', params.cursor);
    if (params.status !== undefined) qs.set('status', params.status);
    if (params.event_type !== undefined) qs.set('event_type', params.event_type);
    const query = qs.toString();
    const result = await this.request<{ events: unknown[]; pagination: unknown }>(
      'GET',
      `/v1/events${query ? `?${query}` : ''}`,
    );
    return { events: z.array(EventSchema).parse(result.events), pagination: result.pagination };
  }

  async getEvent(id: string): Promise<EventDetail> {
    const result = await this.request<unknown>('GET', `/v1/events/${id}`);
    return EventDetailSchema.parse(result);
  }

  async replayEvent(id: string): Promise<unknown> {
    return this.request<unknown>('POST', `/v1/events/${id}/replay`);
  }

  async listDeliveries(
    params: ListDeliveriesParams,
  ): Promise<{ deliveries: Delivery[]; pagination: unknown }> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    if (params.status !== undefined) qs.set('status', params.status);
    if (params.endpointId !== undefined) qs.set('endpointId', params.endpointId);
    if (params.eventId !== undefined) qs.set('eventId', params.eventId);
    const query = qs.toString();
    const result = await this.request<{ deliveries: unknown[]; pagination: unknown }>(
      'GET',
      `/v1/deliveries${query ? `?${query}` : ''}`,
    );
    return {
      deliveries: z.array(DeliverySchema).parse(result.deliveries),
      pagination: result.pagination,
    };
  }
}
