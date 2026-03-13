export interface Endpoint {
  id: string;
  url: string;
  description: string;
  active: boolean;
  eventTypes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  receivedAt: string;
  status: 'pending' | 'processed' | 'failed';
  deliveries: Delivery[];
}

export interface Delivery {
  id: string;
  endpointId: string;
  endpointUrl: string;
  status: 'pending' | 'success' | 'failed';
  statusCode: number | null;
  attempts: number;
  response: string | null;
  sentAt: string | null;
  completedAt: string | null;
}

export class HookwingClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const response = await fetch(url, init);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText || response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async listEndpoints(): Promise<Endpoint[]> {
    return this.request<Endpoint[]>('GET', '/v1/endpoints');
  }

  async createEndpoint(data: {
    url: string;
    description?: string;
    eventTypes?: string[];
  }): Promise<Endpoint> {
    return this.request<Endpoint>('POST', '/v1/endpoints', data);
  }

  async getEndpoint(id: string): Promise<Endpoint> {
    return this.request<Endpoint>('GET', `/v1/endpoints/${id}`);
  }

  async updateEndpoint(
    id: string,
    data: {
      url?: string;
      description?: string;
      active?: boolean;
    },
  ): Promise<Endpoint> {
    return this.request<Endpoint>('PATCH', `/v1/endpoints/${id}`, data);
  }

  async deleteEndpoint(id: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/endpoints/${id}`);
  }

  async listEvents(options?: {
    limit?: number;
    status?: string;
    type?: string;
  }): Promise<Event[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.status) params.set('status', options.status);
    if (options?.type) params.set('type', options.type);
    const query = params.toString();
    return this.request<Event[]>('GET', `/v1/events${query ? `?${query}` : ''}`);
  }

  async getEvent(id: string): Promise<Event> {
    return this.request<Event>('GET', `/v1/events/${id}`);
  }

  async replayEvent(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('POST', `/v1/events/${id}/replay`);
  }

  async replayEvents(ids: string[]): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('POST', '/v1/events/replay-bulk', {
      eventIds: ids,
    });
  }

  async listDeliveries(options?: {
    limit?: number;
    status?: string;
    endpointId?: string;
  }): Promise<Delivery[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.status) params.set('status', options.status);
    if (options?.endpointId) params.set('endpointId', options.endpointId);
    const query = params.toString();
    return this.request<Delivery[]>('GET', `/v1/deliveries${query ? `?${query}` : ''}`);
  }

  async getDelivery(id: string): Promise<Delivery> {
    return this.request<Delivery>('GET', `/v1/deliveries/${id}`);
  }
}
