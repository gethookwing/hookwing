/**
 * Tests for the processDelivery worker function.
 *
 * processDelivery is the Cloudflare Queue consumer that:
 * 1. Fetches the delivery, event, and endpoint from D1
 * 2. Signs the payload with the endpoint's secret
 * 3. POSTs to the endpoint URL
 * 4. Updates delivery status (success / retrying / failed)
 * 5. Schedules retries via DELIVERY_QUEUE.send()
 * 6. Writes to the Dead Letter Queue on final failure (Warbird+ tiers)
 * 7. Tracks analytics (fire-and-forget)
 *
 * Since processDelivery requires D1 + Queue bindings (Cloudflare Workers runtime),
 * we mock createDb and the global fetch to test logic paths without real infra.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeliveryMessage } from '../worker/deliver';

// ─── Shared stub data ────────────────────────────────────────────────────────

const BASE_MESSAGE: DeliveryMessage = {
  deliveryId: 'del_test001',
  eventId: 'evt_test001',
  endpointId: 'ep_test001',
  workspaceId: 'ws_test001',
  attempt: 1,
  priority: 0,
};

const STUB_DELIVERY = {
  id: 'del_test001',
  status: 'attempting',
  attemptNumber: 1,
  nextRetryAt: null,
};

const STUB_EVENT = {
  id: 'evt_test001',
  eventType: 'order.created',
  payload: JSON.stringify({ order_id: 'ord_001', amount: 49.99 }),
  headers: JSON.stringify({ 'Content-Type': 'application/json' }),
  status: 'pending',
  workspaceId: 'ws_test001',
};

const STUB_ENDPOINT = {
  id: 'ep_test001',
  url: 'https://example.com/webhooks',
  secret: 'whsec_testsecret',
  isActive: 1,
  customHeaders: null as string | null,
  eventTypes: null,
};

const STUB_WORKSPACE = {
  id: 'ws_test001',
  tierSlug: 'warbird',
};

// ─── DB mock factory ─────────────────────────────────────────────────────────

/**
 * Build a lightweight mock for the Drizzle DB returned by createDb().
 * Each call to select().from().where().limit().then() resolves to the
 * value returned by the rows factory for that call order.
 */
function makeMockDb(overrides: {
  delivery?: typeof STUB_DELIVERY | null;
  event?: typeof STUB_EVENT | null;
  endpoint?: typeof STUB_ENDPOINT | null;
  workspace?: typeof STUB_WORKSPACE | null;
}) {
  const {
    delivery = STUB_DELIVERY,
    event = STUB_EVENT,
    endpoint = STUB_ENDPOINT,
    workspace = STUB_WORKSPACE,
  } = overrides;

  // Queue of row arrays to return on sequential select() calls
  const rowSequence: object[][] = [
    delivery ? [delivery] : [], // select delivery
    event ? [event] : [], // select event
    endpoint ? [endpoint] : [], // select endpoint
    workspace ? [workspace] : [], // select workspace (on retry/fail paths)
  ];
  let callIndex = 0;

  const updateMock = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });

  const insertMock = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });

  const selectMock = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          // biome-ignore lint/suspicious/noThenProperty: mock needs thenable interface
          then: (resolve: (rows: object[]) => unknown) => {
            const rows = rowSequence[callIndex] ?? [];
            callIndex++;
            return Promise.resolve(resolve(rows));
          },
        }),
      }),
    }),
  }));

  return { select: selectMock, update: updateMock, insert: insertMock };
}

// ─── Module mock setup ───────────────────────────────────────────────────────

// We'll mock createDb to return our mockDb
vi.mock('../db', () => ({
  createDb: vi.fn(),
}));

// Mock analytics (fire-and-forget — we don't want real DB calls)
vi.mock('../services/analytics', () => ({
  trackDeliveryAttempted: vi.fn().mockResolvedValue(undefined),
  trackDeliverySucceeded: vi.fn().mockResolvedValue(undefined),
  trackDeliveryFailed: vi.fn().mockResolvedValue(undefined),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('processDelivery — basic guards', () => {
  it('returns early when DB binding is missing', async () => {
    const { processDelivery } = await import('../worker/deliver');
    // No DB → should return without throwing
    await expect(processDelivery(BASE_MESSAGE, {})).resolves.toBeUndefined();
  });

  it('returns early when delivery is already successful', async () => {
    const { createDb } = await import('../db');
    const mockDb = makeMockDb({ delivery: { ...STUB_DELIVERY, status: 'success' } });
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    // update should NOT have been called (we returned early)
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('returns early when delivery is already failed', async () => {
    const { createDb } = await import('../db');
    const mockDb = makeMockDb({ delivery: { ...STUB_DELIVERY, status: 'failed' } });
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('returns early when delivery record is not found', async () => {
    const { createDb } = await import('../db');
    const mockDb = makeMockDb({ delivery: null });
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

describe('processDelivery — event not found', () => {
  it('marks delivery as failed when event is missing', async () => {
    const { createDb } = await import('../db');
    const mockDb = makeMockDb({ event: null });
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const updateSetWhereMock = vi.fn().mockResolvedValue(undefined);
    const updateSetMock = vi.fn().mockReturnValue({ where: updateSetWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: updateSetMock });
    mockDb.update = updateMock;

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    expect(updateMock).toHaveBeenCalled();
    const setArgs = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('failed');
    expect(setArgs?.errorMessage).toMatch(/not found/i);
  });
});

describe('processDelivery — inactive endpoint', () => {
  it('marks delivery as failed when endpoint is inactive', async () => {
    const { createDb } = await import('../db');
    const mockDb = makeMockDb({ endpoint: { ...STUB_ENDPOINT, isActive: 0 } });
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const updateSetWhereMock = vi.fn().mockResolvedValue(undefined);
    const updateSetMock = vi.fn().mockReturnValue({ where: updateSetWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: updateSetMock });
    mockDb.update = updateMock;

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    expect(updateMock).toHaveBeenCalled();
    const setArgs = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('failed');
  });

  it('marks delivery as failed when endpoint is not found', async () => {
    const { createDb } = await import('../db');
    const mockDb = makeMockDb({ endpoint: null });
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const updateSetWhereMock = vi.fn().mockResolvedValue(undefined);
    const updateSetMock = vi.fn().mockReturnValue({ where: updateSetWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: updateSetMock });
    mockDb.update = updateMock;

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    expect(updateMock).toHaveBeenCalled();
    const setArgs = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('failed');
  });
});

describe('processDelivery — successful delivery (2xx response)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        text: vi.fn().mockResolvedValue('OK'),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks delivery as success on 200 response', async () => {
    const { createDb } = await import('../db');
    const mockDb = makeMockDb({});
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const updateSetWhereMock = vi.fn().mockResolvedValue(undefined);
    const updateSetMock = vi.fn().mockReturnValue({ where: updateSetWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: updateSetMock });
    mockDb.update = updateMock;

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    expect(fetch).toHaveBeenCalledWith(
      STUB_ENDPOINT.url,
      expect.objectContaining({ method: 'POST' }),
    );

    // First update call should set status to 'success'
    const firstSetArgs = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstSetArgs?.status).toBe('success');
    expect(firstSetArgs?.responseStatusCode).toBe(200);
  });

  it('POSTs to the correct endpoint URL', async () => {
    const { createDb } = await import('../db');
    const mockDb = makeMockDb({});
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    expect(fetch).toHaveBeenCalledWith('https://example.com/webhooks', expect.anything());
  });

  it('includes Hookwing signature headers in the request', async () => {
    const { createDb } = await import('../db');
    const mockDb = makeMockDb({});
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const headers = (fetchCall?.[1] as RequestInit)?.headers as Record<string, string>;
    expect(headers?.['X-Hookwing-Signature']).toBeDefined();
    expect(headers?.['X-Hookwing-Event']).toBe('order.created');
    expect(headers?.['X-Hookwing-Delivery-Id']).toBe('del_test001');
  });

  it('marks delivery success on 201 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 201,
        text: vi.fn().mockResolvedValue('Created'),
      }),
    );

    const { createDb } = await import('../db');
    const mockDb = makeMockDb({});
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);
    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update = vi.fn().mockReturnValue({ set: updateSetMock });

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    const firstSetArgs = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstSetArgs?.status).toBe('success');
  });

  it('marks delivery success on 204 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 204,
        text: vi.fn().mockResolvedValue(''),
      }),
    );

    const { createDb } = await import('../db');
    const mockDb = makeMockDb({});
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);
    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update = vi.fn().mockReturnValue({ set: updateSetMock });

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    const firstSetArgs = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstSetArgs?.status).toBe('success');
  });
});

describe('processDelivery — failed delivery with retries', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('schedules a retry on 500 response (attempt 1 of 3)', async () => {
    const { createDb } = await import('../db');
    const mockDb = makeMockDb({ workspace: { id: 'ws_test001', tierSlug: 'warbird' } });
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const updateSetWhereMock = vi.fn().mockResolvedValue(undefined);
    const updateSetMock = vi.fn().mockReturnValue({ where: updateSetWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: updateSetMock });
    mockDb.update = updateMock;

    const queueSendMock = vi.fn().mockResolvedValue(undefined);
    const mockQueue = { send: queueSendMock } as unknown as Queue;

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database, DELIVERY_QUEUE: mockQueue });

    // Should update delivery to 'retrying'
    const setArgs = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('retrying');

    // Should enqueue retry
    expect(queueSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: 'del_test001',
        attempt: 2,
      }),
    );
  });

  it('sets nextRetryAt to a future timestamp on retry', async () => {
    const { createDb } = await import('../db');
    const mockDb = makeMockDb({});
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update = vi.fn().mockReturnValue({ set: updateSetMock });

    const { processDelivery } = await import('../worker/deliver');
    const before = Date.now();
    await processDelivery(BASE_MESSAGE, {
      DB: {} as D1Database,
      DELIVERY_QUEUE: { send: vi.fn() } as unknown as Queue,
    });
    const after = Date.now();

    const setArgs = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const nextRetryAt = setArgs?.nextRetryAt as number;
    expect(nextRetryAt).toBeGreaterThan(before);
    expect(nextRetryAt).toBeLessThan(after + 2 * 60 * 1000); // within 2 minutes
  });

  it('does NOT enqueue retry when DELIVERY_QUEUE is absent', async () => {
    const { createDb } = await import('../db');
    const mockDb = makeMockDb({});
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });

    const { processDelivery } = await import('../worker/deliver');
    // No queue — should not throw
    await expect(processDelivery(BASE_MESSAGE, { DB: {} as D1Database })).resolves.toBeUndefined();
  });

  it('marks delivery as failed after max attempts exhausted', async () => {
    const { createDb } = await import('../db');
    // Attempt 6 (= max for warbird tier typically; shouldRetry will return false)
    const messageAtMax: DeliveryMessage = { ...BASE_MESSAGE, attempt: 10 };
    const mockDb = makeMockDb({});
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update = vi.fn().mockReturnValue({ set: updateSetMock });
    mockDb.insert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const queueSendMock = vi.fn();

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(messageAtMax, {
      DB: {} as D1Database,
      DELIVERY_QUEUE: { send: queueSendMock } as unknown as Queue,
    });

    // Should mark delivery as failed
    const setArgs = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('failed');

    // Should NOT enqueue retry
    expect(queueSendMock).not.toHaveBeenCalled();
  });
});

describe('processDelivery — network error / fetch throws', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('handles network error gracefully and schedules retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const { createDb } = await import('../db');
    const mockDb = makeMockDb({});
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update = vi.fn().mockReturnValue({ set: updateSetMock });

    const queueSendMock = vi.fn().mockResolvedValue(undefined);

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, {
      DB: {} as D1Database,
      DELIVERY_QUEUE: { send: queueSendMock } as unknown as Queue,
    });

    // Status should be 'retrying' (network error on attempt 1 → retry)
    const setArgs = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('retrying');
    expect(queueSendMock).toHaveBeenCalled();
  });

  it('records error message on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    const { createDb } = await import('../db');
    const mockDb = makeMockDb({});
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update = vi.fn().mockReturnValue({ set: updateSetMock });

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    const setArgs = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(typeof setArgs?.errorMessage).toBe('string');
    expect((setArgs?.errorMessage as string).length).toBeGreaterThan(0);
  });
});

describe('processDelivery — 4xx responses (not retried)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('schedules retry on 404 response (endpoint URL issue is retryable)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 404,
        text: vi.fn().mockResolvedValue('Not Found'),
      }),
    );

    const { createDb } = await import('../db');
    const mockDb = makeMockDb({});
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update = vi.fn().mockReturnValue({ set: updateSetMock });
    const queueSend = vi.fn().mockResolvedValue(undefined);

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, {
      DB: {} as D1Database,
      DELIVERY_QUEUE: { send: queueSend } as unknown as Queue,
    });

    // Non-2xx on attempt 1 → retrying
    const setArgs = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('retrying');
  });

  it('records response status code on non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 422,
        text: vi.fn().mockResolvedValue('Unprocessable Entity'),
      }),
    );

    const { createDb } = await import('../db');
    const mockDb = makeMockDb({});
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update = vi.fn().mockReturnValue({ set: updateSetMock });

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    const setArgs = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.responseStatusCode).toBe(422);
  });
});

describe('processDelivery — workspace not found', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks delivery as failed when workspace is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 500,
        text: vi.fn().mockResolvedValue('Error'),
      }),
    );

    const { createDb } = await import('../db');
    const mockDb = makeMockDb({ workspace: null });
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);

    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update = vi.fn().mockReturnValue({ set: updateSetMock });

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    const setArgs = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('failed');
    expect(setArgs?.errorMessage).toMatch(/workspace not found/i);
  });
});

describe('processDelivery — custom headers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('injects custom headers when endpoint has customHeaders configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        text: vi.fn().mockResolvedValue('OK'),
      }),
    );

    const endpointWithCustomHeaders = {
      ...STUB_ENDPOINT,
      customHeaders: JSON.stringify({ 'X-Custom-Token': 'my-secret-token', 'X-Env': 'prod' }),
    };

    const { createDb } = await import('../db');
    const mockDb = makeMockDb({ endpoint: endpointWithCustomHeaders });
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });

    const { processDelivery } = await import('../worker/deliver');
    await processDelivery(BASE_MESSAGE, { DB: {} as D1Database });

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const headers = (fetchCall?.[1] as RequestInit)?.headers as Record<string, string>;
    expect(headers?.['X-Custom-Token']).toBe('my-secret-token');
    expect(headers?.['X-Env']).toBe('prod');
  });

  it('proceeds without crashing when customHeaders is invalid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        text: vi.fn().mockResolvedValue('OK'),
      }),
    );

    const endpointWithBadHeaders = { ...STUB_ENDPOINT, customHeaders: '{invalid-json' };

    const { createDb } = await import('../db');
    const mockDb = makeMockDb({ endpoint: endpointWithBadHeaders });
    vi.mocked(createDb).mockReturnValue(mockDb as unknown as ReturnType<typeof createDb>);
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });

    const { processDelivery } = await import('../worker/deliver');
    // Should not throw
    await expect(processDelivery(BASE_MESSAGE, { DB: {} as D1Database })).resolves.toBeUndefined();
  });
});
