import { describe, expect, it } from 'vitest';
import { app } from '../index';

interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
}

interface ErrorResponse {
  error: string;
  status: number;
}

describe('GET /health', () => {
  it('should return 200 with status ok and version', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = (await res.json()) as HealthResponse;
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.0.1');
  });

  it('should include timestamp in ISO format', async () => {
    const res = await app.request('/health');
    const body = (await res.json()) as HealthResponse;

    expect(body.timestamp).toBeDefined();
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});

describe('GET /unknown', () => {
  it('should return 404 with error message', async () => {
    const res = await app.request('/unknown');
    expect(res.status).toBe(404);

    const body = (await res.json()) as ErrorResponse;
    expect(body.error).toBe('Not found');
  });
});

describe('cross-package imports', () => {
  it('should resolve @hookwing/shared types at runtime', async () => {
    // Verify the shared package is importable (workspace link works)
    const shared = await import('@hookwing/shared');
    expect(shared.DEFAULT_TIERS).toBeDefined();
    expect(shared.getTierBySlug('free')).toBeDefined();
  });
});
