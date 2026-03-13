import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HookwingClient } from '../client.js';

describe('HookwingClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('constructor', () => {
    it('creates client with api key and base url', () => {
      const client = new HookwingClient('test-key', 'https://api.example.com');
      expect(client).toBeDefined();
    });

    it('strips trailing slash from base url', () => {
      const client = new HookwingClient('test-key', 'https://api.example.com/');
      expect(client).toBeDefined();
    });
  });

  describe('listEndpoints', () => {
    it('calls API and returns endpoints', async () => {
      const mockEndpoints = [
        {
          id: 'ep1',
          url: 'https://example.com/hook',
          active: true,
          eventTypes: ['test'],
          description: '',
          createdAt: '',
          updatedAt: '',
        },
      ];

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEndpoints),
      });

      const client = new HookwingClient('test-key', 'https://api.hookwing.com');
      const result = await client.listEndpoints();

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.hookwing.com/v1/endpoints',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(mockEndpoints);
    });

    it('throws on non-2xx response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Invalid API key'),
      });

      const client = new HookwingClient('invalid-key', 'https://api.hookwing.com');

      await expect(client.listEndpoints()).rejects.toThrow('API error (401): Invalid API key');
    });

    it('throws on network error', async () => {
      fetchMock.mockRejectedValue(new Error('Connection refused'));

      const client = new HookwingClient('test-key', 'https://api.hookwing.com');

      await expect(client.listEndpoints()).rejects.toThrow('Connection refused');
    });
  });

  describe('createEndpoint', () => {
    it('sends POST request with endpoint data', async () => {
      const mockEndpoint = {
        id: 'ep-new',
        url: 'https://example.com/new',
        active: true,
        eventTypes: ['order.created'],
        description: 'New endpoint',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEndpoint),
      });

      const client = new HookwingClient('test-key', 'https://api.hookwing.com');
      const result = await client.createEndpoint({
        url: 'https://example.com/new',
        description: 'New endpoint',
        eventTypes: ['order.created'],
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.hookwing.com/v1/endpoints',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            url: 'https://example.com/new',
            description: 'New endpoint',
            eventTypes: ['order.created'],
          }),
        }),
      );
      expect(result).toEqual(mockEndpoint);
    });
  });

  describe('deleteEndpoint', () => {
    it('sends DELETE request', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(undefined),
      });

      const client = new HookwingClient('test-key', 'https://api.hookwing.com');
      await client.deleteEndpoint('ep-123');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.hookwing.com/v1/endpoints/ep-123',
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  describe('replayEvent', () => {
    it('sends POST request to replay endpoint', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const client = new HookwingClient('test-key', 'https://api.hookwing.com');
      const result = await client.replayEvent('evt-123');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.hookwing.com/v1/events/evt-123/replay',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('listDeliveries', () => {
    it('passes query parameters correctly', async () => {
      const mockDeliveries = [
        {
          id: 'del1',
          endpointId: 'ep1',
          endpointUrl: 'https://example.com',
          status: 'success',
          statusCode: 200,
          attempts: 1,
          response: null,
          sentAt: null,
          completedAt: null,
        },
      ];

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDeliveries),
      });

      const client = new HookwingClient('test-key', 'https://api.hookwing.com');
      await client.listDeliveries({ limit: 10, status: 'failed', endpointId: 'ep1' });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.hookwing.com/v1/deliveries?limit=10&status=failed&endpointId=ep1',
        expect.any(Object),
      );
    });
  });
});
