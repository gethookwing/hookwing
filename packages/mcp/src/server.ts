import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { HookwingClient } from './client.js';

function getApiKey(apiKey?: string): string {
  return apiKey ?? process.env.HOOKWING_API_KEY ?? '';
}

function getBaseUrl(baseUrl?: string): string {
  return baseUrl ?? process.env.HOOKWING_API_URL ?? 'https://api.hookwing.com';
}

function noKey() {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: 'API key is required' }) }],
  };
}

export function createServer(): McpServer {
  const server = new McpServer({ name: 'hookwing', version: '0.0.1' });

  // Tool 1: list_endpoints
  server.tool(
    'list_endpoints',
    'List all webhook endpoints for the workspace',
    {
      apiKey: z.string().optional().describe('API key (or set HOOKWING_API_KEY env var)'),
      baseUrl: z.string().optional().describe('API base URL (or set HOOKWING_API_URL env var)'),
    },
    async ({ apiKey, baseUrl }) => {
      const key = getApiKey(apiKey);
      if (!key) return noKey();
      const client = new HookwingClient(key, getBaseUrl(baseUrl));
      const result = await client.listEndpoints();
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // Tool 2: create_endpoint
  server.tool(
    'create_endpoint',
    'Create a new webhook endpoint',
    {
      apiKey: z.string().optional().describe('API key (or set HOOKWING_API_KEY env var)'),
      baseUrl: z.string().optional().describe('API base URL (or set HOOKWING_API_URL env var)'),
      url: z.string().describe('Destination URL for webhooks (must use HTTPS)'),
      description: z.string().optional().describe('Human-readable description'),
      eventTypes: z
        .array(z.string())
        .optional()
        .describe('Event types to subscribe to (omit for all)'),
    },
    async ({ apiKey, baseUrl, url, description, eventTypes }) => {
      const key = getApiKey(apiKey);
      if (!key) return noKey();
      const client = new HookwingClient(key, getBaseUrl(baseUrl));
      const input: { url: string; description?: string; eventTypes?: string[] } = { url };
      if (description !== undefined) input.description = description;
      if (eventTypes !== undefined) input.eventTypes = eventTypes;
      const result = await client.createEndpoint(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // Tool 3: delete_endpoint
  server.tool(
    'delete_endpoint',
    'Delete a webhook endpoint by ID',
    {
      apiKey: z.string().optional().describe('API key (or set HOOKWING_API_KEY env var)'),
      baseUrl: z.string().optional().describe('API base URL (or set HOOKWING_API_URL env var)'),
      endpointId: z.string().describe('ID of the endpoint to delete'),
    },
    async ({ apiKey, baseUrl, endpointId }) => {
      const key = getApiKey(apiKey);
      if (!key) return noKey();
      const client = new HookwingClient(key, getBaseUrl(baseUrl));
      await client.deleteEndpoint(endpointId);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    },
  );

  // Tool 4: list_events
  server.tool(
    'list_events',
    'List recent events with optional filtering',
    {
      apiKey: z.string().optional().describe('API key (or set HOOKWING_API_KEY env var)'),
      baseUrl: z.string().optional().describe('API base URL (or set HOOKWING_API_URL env var)'),
      limit: z.number().optional().describe('Max events to return (1-100, default 50)'),
      cursor: z.string().optional().describe('Pagination cursor'),
      status: z
        .enum(['pending', 'processing', 'completed', 'failed'])
        .optional()
        .describe('Filter by status'),
      event_type: z.string().optional().describe('Filter by event type'),
    },
    async ({ apiKey, baseUrl, limit, cursor, status, event_type }) => {
      const key = getApiKey(apiKey);
      if (!key) return noKey();
      const client = new HookwingClient(key, getBaseUrl(baseUrl));
      const params: Parameters<typeof client.listEvents>[0] = {};
      if (limit !== undefined) params.limit = limit;
      if (cursor !== undefined) params.cursor = cursor;
      if (status !== undefined) params.status = status;
      if (event_type !== undefined) params.event_type = event_type;
      const result = await client.listEvents(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // Tool 5: get_event
  server.tool(
    'get_event',
    'Get a single event with delivery details',
    {
      apiKey: z.string().optional().describe('API key (or set HOOKWING_API_KEY env var)'),
      baseUrl: z.string().optional().describe('API base URL (or set HOOKWING_API_URL env var)'),
      eventId: z.string().describe('ID of the event to retrieve'),
    },
    async ({ apiKey, baseUrl, eventId }) => {
      const key = getApiKey(apiKey);
      if (!key) return noKey();
      const client = new HookwingClient(key, getBaseUrl(baseUrl));
      const result = await client.getEvent(eventId);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // Tool 6: replay_event
  server.tool(
    'replay_event',
    'Replay an event — re-deliver to all active endpoints',
    {
      apiKey: z.string().optional().describe('API key (or set HOOKWING_API_KEY env var)'),
      baseUrl: z.string().optional().describe('API base URL (or set HOOKWING_API_URL env var)'),
      eventId: z.string().describe('ID of the event to replay'),
    },
    async ({ apiKey, baseUrl, eventId }) => {
      const key = getApiKey(apiKey);
      if (!key) return noKey();
      const client = new HookwingClient(key, getBaseUrl(baseUrl));
      const result = await client.replayEvent(eventId);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // Tool 7: list_deliveries
  server.tool(
    'list_deliveries',
    'List delivery attempts with optional filtering',
    {
      apiKey: z.string().optional().describe('API key (or set HOOKWING_API_KEY env var)'),
      baseUrl: z.string().optional().describe('API base URL (or set HOOKWING_API_URL env var)'),
      limit: z.number().optional().describe('Max deliveries to return (1-100, default 50)'),
      offset: z.number().optional().describe('Skip N deliveries for pagination'),
      status: z
        .enum(['pending', 'success', 'failed', 'retrying'])
        .optional()
        .describe('Filter by status'),
      endpointId: z.string().optional().describe('Filter by endpoint ID'),
      eventId: z.string().optional().describe('Filter by event ID'),
    },
    async ({ apiKey, baseUrl, limit, offset, status, endpointId, eventId }) => {
      const key = getApiKey(apiKey);
      if (!key) return noKey();
      const client = new HookwingClient(key, getBaseUrl(baseUrl));
      const params: Parameters<typeof client.listDeliveries>[0] = {};
      if (limit !== undefined) params.limit = limit;
      if (offset !== undefined) params.offset = offset;
      if (status !== undefined) params.status = status;
      if (endpointId !== undefined) params.endpointId = endpointId;
      if (eventId !== undefined) params.eventId = eventId;
      const result = await client.listDeliveries(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  return server;
}
