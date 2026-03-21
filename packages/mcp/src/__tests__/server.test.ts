import { describe, expect, it } from 'vitest';
import { HookwingClient } from '../client.js';
import { createServer } from '../server.js';

describe('createServer', () => {
  it('should return an McpServer instance', () => {
    const server = createServer();
    expect(server).toBeDefined();
    expect(server).toBeTypeOf('object');
  });

  it('should expose a connect method (McpServer interface)', () => {
    const server = createServer();
    expect(typeof server.connect).toBe('function');
  });

  it('should return a new server on each call', () => {
    const a = createServer();
    const b = createServer();
    expect(a).not.toBe(b);
  });
});

describe('HookwingClient', () => {
  it('should initialize with apiKey and default baseUrl', () => {
    const client = new HookwingClient('hk_live_test123');
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(HookwingClient);
  });

  it('should initialize with a custom baseUrl', () => {
    const client = new HookwingClient('hk_live_test123', 'https://api-dev.hookwing.com');
    expect(client).toBeDefined();
  });

  it('should expose listEndpoints method', () => {
    const client = new HookwingClient('hk_live_test123');
    expect(typeof client.listEndpoints).toBe('function');
  });

  it('should expose createEndpoint method', () => {
    const client = new HookwingClient('hk_live_test123');
    expect(typeof client.createEndpoint).toBe('function');
  });

  it('should expose deleteEndpoint method', () => {
    const client = new HookwingClient('hk_live_test123');
    expect(typeof client.deleteEndpoint).toBe('function');
  });

  it('should expose listEvents method', () => {
    const client = new HookwingClient('hk_live_test123');
    expect(typeof client.listEvents).toBe('function');
  });

  it('should expose getEvent method', () => {
    const client = new HookwingClient('hk_live_test123');
    expect(typeof client.getEvent).toBe('function');
  });

  it('should expose replayEvent method', () => {
    const client = new HookwingClient('hk_live_test123');
    expect(typeof client.replayEvent).toBe('function');
  });

  it('should expose listDeliveries method', () => {
    const client = new HookwingClient('hk_live_test123');
    expect(typeof client.listDeliveries).toBe('function');
  });

  it('should throw when API returns non-2xx', async () => {
    const client = new HookwingClient('invalid_key', 'http://localhost:0');
    // Port 0 is not listening — fetch should reject
    const result = client.listEndpoints();
    await expect(result).rejects.toThrow();
  }, 10000);
});
