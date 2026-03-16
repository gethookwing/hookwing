import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createRateLimitMiddlewareMock = vi.fn(() => {
  return async (c: {
    req: { path: string };
    header: (name: string, value: string) => void;
    json: (body: object, status?: number) => Response | Promise<Response>;
  }) => {
    c.header('X-RateLimit-Limit', '5');
    c.header('X-RateLimit-Remaining', '0');
    c.header('X-RateLimit-Reset', '1234567890');
    c.header('Retry-After', '60');
    return c.json({ error: 'Rate limit exceeded' }, 429);
  };
});

async function loadAuthRoutes() {
  vi.resetModules();
  vi.doMock('../middleware/rateLimit', async () => {
    const actual = await vi.importActual<typeof import('../middleware/rateLimit')>(
      '../middleware/rateLimit',
    );

    return {
      ...actual,
      createRateLimitMiddleware: createRateLimitMiddlewareMock,
    };
  });

  const module = await import('../routes/auth');
  return module.default;
}

describe('auth abuse protection wiring', () => {
  beforeEach(() => {
    createRateLimitMiddlewareMock.mockClear();
  });

  it('attaches rate limiting to signup and surfaces 429 headers', async () => {
    const authRoutes = await loadAuthRoutes();
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    expect(createRateLimitMiddlewareMock).toHaveBeenCalled();
    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('attaches rate limiting to login and surfaces 429 headers', async () => {
    const authRoutes = await loadAuthRoutes();
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    expect(createRateLimitMiddlewareMock).toHaveBeenCalled();
    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

});
