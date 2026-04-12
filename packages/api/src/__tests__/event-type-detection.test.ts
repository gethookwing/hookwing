import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  createDb: vi.fn(),
}));

vi.mock('../services/analytics', () => ({
  trackEventReceived: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/fanout', () => ({
  fanoutEvent: vi.fn().mockResolvedValue({ deliveries: [] }),
  processRoutingRules: vi.fn().mockResolvedValue([]),
}));

import { createDb } from '../db';
import ingestRoutes from '../routes/ingest';

const makeApp = () => new Hono().route('/v1/ingest', ingestRoutes);

const ENDPOINT = {
  id: 'ep_test_123',
  workspaceId: 'ws_test_123',
  isActive: true,
  secret: 'whsec_test',
  eventTypes: null as string | null,
  sourceId: null as string | null,
};

const WORKSPACE = {
  id: 'ws_test_123',
  tierSlug: 'stealth-jet',
};

function makeMockDb(endpointOverrides: Partial<typeof ENDPOINT> = {}) {
  const endpoint = { ...ENDPOINT, ...endpointOverrides };
  const insertedRows: Record<string, unknown>[] = [];
  const selectResults = [[endpoint], [WORKSPACE]];
  let selectIndex = 0;

  const selectBuilder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => ({
      // biome-ignore lint/suspicious/noThenProperty: mock needs thenable interface
      then: (resolve: (rows: unknown[]) => unknown) =>
        Promise.resolve(resolve(selectResults[selectIndex++] ?? [])),
    })),
  };

  const insertBuilder = {
    values: vi.fn().mockImplementation((value: Record<string, unknown>) => {
      insertedRows.push(value);
      return Promise.resolve(undefined);
    }),
  };

  const db = {
    select: vi.fn(() => selectBuilder),
    insert: vi.fn(() => insertBuilder),
    delete: vi.fn(),
  };

  return { db, insertedRows };
}

describe('event type detection on ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores the X-Event-Type header value when provided', async () => {
    const { db, insertedRows } = makeMockDb();
    vi.mocked(createDb).mockReturnValue(db as never);

    const res = await makeApp().request(
      '/v1/ingest/ep_test_123',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Event-Type': 'order.created',
        },
        body: JSON.stringify({ orderId: 'ord_123' }),
      },
      {
        DB: {} as D1Database,
        DELIVERY_QUEUE: { send: vi.fn() } as unknown as Queue,
      },
    );

    expect(res.status).toBe(200);
    const insertedEvent = insertedRows.find((row) => 'eventType' in row && 'payload' in row);
    expect(insertedEvent?.eventType).toBe('order.created');
  });

  it("falls back to 'unknown' when no X-Event-Type header is present", async () => {
    const { db, insertedRows } = makeMockDb();
    vi.mocked(createDb).mockReturnValue(db as never);

    const res = await makeApp().request(
      '/v1/ingest/ep_test_123',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventType: 'body.only.event' }),
      },
      {
        DB: {} as D1Database,
        DELIVERY_QUEUE: { send: vi.fn() } as unknown as Queue,
      },
    );

    expect(res.status).toBe(200);
    const insertedEvent = insertedRows.find((row) => 'eventType' in row && 'payload' in row);
    expect(insertedEvent?.eventType).toBe('unknown');
  });

  it('rejects event types outside the endpoint allowlist', async () => {
    const { db, insertedRows } = makeMockDb({
      eventTypes: JSON.stringify(['invoice.paid']),
    });
    vi.mocked(createDb).mockReturnValue(db as never);

    const res = await makeApp().request(
      '/v1/ingest/ep_test_123',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Event-Type': 'order.created',
        },
        body: JSON.stringify({ orderId: 'ord_999' }),
      },
      {
        DB: {} as D1Database,
        DELIVERY_QUEUE: { send: vi.fn() } as unknown as Queue,
      },
    );

    expect(res.status).toBe(400);
    const insertedEvent = insertedRows.find((row) => 'eventType' in row && 'payload' in row);
    expect(insertedEvent).toBeUndefined();
    await expect(res.json()).resolves.toMatchObject({
      error: 'Event type not allowed for this endpoint',
    });
  });
});
