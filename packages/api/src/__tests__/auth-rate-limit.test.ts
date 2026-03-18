import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock that returns 429 for IP-based rate limiting (to test 429 case)
const createRateLimitMiddlewareMock429 = vi.fn(() => {
  return async (
    c: {
      req: { path: string };
      header: (name: string, value: string) => void;
      json: (body: object, status?: number) => Response | Promise<Response>;
    },
    _next: () => Promise<void>,
  ) => {
    c.header('X-RateLimit-Limit', '5');
    c.header('X-RateLimit-Remaining', '0');
    c.header('X-RateLimit-Reset', '1234567890');
    c.header('Retry-After', '60');
    return c.json({ error: 'Rate limit exceeded' }, 429);
  };
});

// Mock that allows request through (to test success case)
const createRateLimitMiddlewareMockPass = vi.fn(() => {
  return async (
    c: {
      req: { path: string };
      header: (name: string, value: string) => void;
      json: (body: object, status?: number) => Response | Promise<Response>;
    },
    next: () => Promise<void>,
  ) => {
    c.header('X-RateLimit-Limit', '5');
    c.header('X-RateLimit-Remaining', '4');
    c.header('X-RateLimit-Reset', '1234567890');
    // Allow request to pass through by calling next()
    await next();
  };
});

async function loadAuthRoutes(return429 = true) {
  vi.resetModules();
  const mock = return429 ? createRateLimitMiddlewareMock429 : createRateLimitMiddlewareMockPass;
  vi.doMock('../middleware/rateLimit', async () => {
    const actual =
      await vi.importActual<typeof import('../middleware/rateLimit')>('../middleware/rateLimit');

    return {
      ...actual,
      createRateLimitMiddleware: mock,
    };
  });

  const module = await import('../routes/auth');
  return module.default;
}

describe('auth abuse protection wiring', () => {
  beforeEach(() => {
    createRateLimitMiddlewareMock429.mockClear();
    createRateLimitMiddlewareMockPass.mockClear();
  });

  it('attaches rate limiting to signup and surfaces 429 headers', async () => {
    const authRoutes = await loadAuthRoutes(true);
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    expect(createRateLimitMiddlewareMock429).toHaveBeenCalled();
    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('attaches rate limiting to login and surfaces 429 headers', async () => {
    const authRoutes = await loadAuthRoutes(true);
    const app = new Hono().route('/v1/auth', authRoutes);
    const res = await app.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    expect(createRateLimitMiddlewareMock429).toHaveBeenCalled();
    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });
});

describe('auth abuse protection - timing enumeration prevention', () => {
  it('login does password verification even for nonexistent users', async () => {
    // This test verifies that login performs password verification
    // even when the user doesn't exist, preventing timing enumeration.
    // The key is that verifyPassword is called with a dummy hash
    // for nonexistent users, taking similar time to real verification.

    vi.resetModules();

    // Create a mock that tracks if verifyPassword was called
    const verifyPasswordMock = vi.fn().mockResolvedValue(false);
    vi.doMock('@hookwing/shared', async () => {
      const actual = await vi.importActual<typeof import('@hookwing/shared')>('@hookwing/shared');
      return {
        ...actual,
        verifyPassword: verifyPasswordMock,
      };
    });

    // Use the pass-through mock for IP rate limiting and mock applyRateLimit
    vi.doMock('../middleware/rateLimit', async () => {
      const actual =
        await vi.importActual<typeof import('../middleware/rateLimit')>('../middleware/rateLimit');

      return {
        ...actual,
        createRateLimitMiddleware: createRateLimitMiddlewareMockPass,
        applyRateLimit: vi.fn().mockResolvedValue({
          limit: 5,
          remaining: 4,
          resetTime: Math.ceil(Date.now() / 1000) + 60,
          overLimit: false,
        }),
      };
    });

    // Mock the database to return no workspace (nonexistent user)
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock('../db', () => ({
      createDb: () => mockDb,
    }));

    const { default: authRoutes } = await import('../routes/auth');
    const app = new Hono<{ Bindings: { DB?: D1Database } }>().route('/v1/auth', authRoutes);

    const res = await app.request(
      '/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'nonexistent@example.com', password: 'anypassword' }),
      },
      { DB: {} as D1Database },
    );

    // Should return 401 for invalid credentials
    expect(res.status).toBe(401);

    // verifyPassword should have been called (even for nonexistent user)
    // This is the key timing enumeration fix
    expect(verifyPasswordMock).toHaveBeenCalled();
  });

  it('login returns same error message for wrong password vs nonexistent user', async () => {
    // This ensures an attacker cannot distinguish between
    // "user doesn't exist" and "wrong password" via error messages

    vi.resetModules();

    const genericErrorMessage = 'Invalid email or password';

    // Mock verifyPassword to return false (wrong password)
    const verifyPasswordMock = vi.fn().mockResolvedValue(false);
    vi.doMock('@hookwing/shared', async () => {
      const actual = await vi.importActual<typeof import('@hookwing/shared')>('@hookwing/shared');
      return {
        ...actual,
        verifyPassword: verifyPasswordMock,
      };
    });

    vi.doMock('../middleware/rateLimit', async () => {
      const actual =
        await vi.importActual<typeof import('../middleware/rateLimit')>('../middleware/rateLimit');

      return {
        ...actual,
        createRateLimitMiddleware: createRateLimitMiddlewareMockPass,
        applyRateLimit: vi.fn().mockResolvedValue({
          limit: 5,
          remaining: 4,
          resetTime: Math.ceil(Date.now() / 1000) + 60,
          overLimit: false,
        }),
      };
    });

    // Mock workspace exists but password is wrong
    const mockWorkspace = {
      id: 'ws_123',
      email: 'user@example.com',
      passwordHash: 'real:hash',
      name: 'Test',
      slug: 'test',
      tierSlug: 'paper-plane',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([mockWorkspace]),
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock('../db', () => ({
      createDb: () => mockDb,
    }));

    const { default: authRoutes } = await import('../routes/auth');
    const app = new Hono<{ Bindings: { DB?: D1Database } }>().route('/v1/auth', authRoutes);

    const res = await app.request(
      '/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com', password: 'wrongpassword' }),
      },
      { DB: {} as D1Database },
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe(genericErrorMessage);
  });
});

describe('auth rate limit headers on success', () => {
  it('preserves IP-based rate limit headers on successful login', async () => {
    vi.resetModules();

    // Mock successful auth (valid credentials)
    const verifyPasswordMock = vi.fn().mockResolvedValue(true);
    vi.doMock('@hookwing/shared', async () => {
      const actual = await vi.importActual<typeof import('@hookwing/shared')>('@hookwing/shared');
      return {
        ...actual,
        verifyPassword: verifyPasswordMock,
        generateApiKey: vi.fn().mockResolvedValue({
          key: 'hk_test_key',
          hash: 'hashed',
          prefix: 'hk_test',
        }),
        generateId: vi.fn().mockReturnValue('test_id'),
        getTierBySlug: vi.fn().mockReturnValue({ name: 'Paper Plane' }),
      };
    });

    vi.doMock('../middleware/rateLimit', async () => {
      const actual =
        await vi.importActual<typeof import('../middleware/rateLimit')>('../middleware/rateLimit');

      return {
        ...actual,
        createRateLimitMiddleware: createRateLimitMiddlewareMockPass,
        applyRateLimit: vi.fn().mockResolvedValue({
          limit: 5,
          remaining: 4,
          resetTime: Math.ceil(Date.now() / 1000) + 60,
          overLimit: false,
        }),
      };
    });

    const mockWorkspace = {
      id: 'ws_123',
      email: 'user@example.com',
      passwordHash: 'real:hash',
      name: 'Test',
      slug: 'test',
      tierSlug: 'paper-plane',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Add the proper insert mock
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([mockWorkspace]),
          }),
        }),
      }),
      insert: () => ({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };

    vi.doMock('../db', () => ({
      createDb: () => mockDb,
    }));

    const { default: authRoutes } = await import('../routes/auth');
    const app = new Hono<{ Bindings: { DB?: D1Database } }>().route('/v1/auth', authRoutes);

    const res = await app.request(
      '/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com', password: 'correctpassword' }),
      },
      { DB: {} as D1Database },
    );

    // Should succeed (either 200 or 201 depending on existing keys)
    expect([200, 201]).toContain(res.status);

    // IP-based rate limit headers should be present
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
  });
});

describe('auth credential-aware throttling', () => {
  it('uses a stable email fingerprint instead of the raw email in the rate-limit key', async () => {
    vi.resetModules();

    const applyRateLimitMock = vi.fn().mockResolvedValue({
      limit: 5,
      remaining: 4,
      resetTime: Math.ceil(Date.now() / 1000) + 60,
      overLimit: false,
    });

    vi.doMock('../middleware/rateLimit', async () => {
      const actual =
        await vi.importActual<typeof import('../middleware/rateLimit')>('../middleware/rateLimit');

      return {
        ...actual,
        createRateLimitMiddleware: createRateLimitMiddlewareMockPass,
        applyRateLimit: applyRateLimitMock,
      };
    });

    vi.doMock('../db', () => ({
      createDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue(undefined),
      }),
    }));

    const { default: authRoutes } = await import('../routes/auth');
    const app = new Hono<{ Bindings: { DB?: D1Database } }>().route('/v1/auth', authRoutes);

    await app.request(
      '/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'User@Example.com', password: 'password123' }),
      },
      { DB: {} as D1Database },
    );

    await app.request(
      '/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'USER@example.com', password: 'password123' }),
      },
      { DB: {} as D1Database },
    );

    const firstKey = applyRateLimitMock.mock.calls[0]?.[1];
    const secondKey = applyRateLimitMock.mock.calls[1]?.[1];

    expect(firstKey).toBeDefined();
    expect(firstKey).toBe(secondKey);
    expect(firstKey).not.toContain('user@example.com');
    expect(firstKey).toMatch(/^auth:login:email:[a-f0-9]{64}$/);
  });
});
