/**
 * Unit tests for fanout service core logic (fanoutEvent, processRoutingRules)
 *
 * fanout.test.ts covers only schema validation. These tests exercise the service
 * layer: event distribution, fanout filtering, event-type matching, routing rules,
 * queue enqueueing, and the inactive-receiving-endpoint edge case.
 */

import { describe, expect, it, vi } from 'vitest';
import { fanoutEvent, processRoutingRules } from '../services/fanout';

// ─── Stubs ──────────────────────────────────────────────────────────────────

const BASE_EVENT = { id: 'evt_001', workspaceId: 'ws_001', eventType: 'order.created' };

function ep(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ep_001',
    workspaceId: 'ws_001',
    url: 'https://example.com/wh',
    isActive: 1,
    fanoutEnabled: 1,
    eventTypes: null as string | null,
    secret: 'sec_abc',
    ...overrides,
  };
}

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule_001',
    workspaceId: 'ws_001',
    conditions: JSON.stringify([
      { field: 'event.type', operator: 'equals', value: 'order.created' },
    ]),
    actionType: 'deliver',
    actionEndpointId: 'ep_target',
    enabled: 1,
    priority: 1,
    ...overrides,
  };
}

// ─── DB mock factory ─────────────────────────────────────────────────────────

/**
 * Build a sequential DB mock. Each call to db.select() pops the next row array
 * from rowSequences. Supports all three Drizzle query chain patterns used by fanout:
 *   - .where().then(rows => ...)             — fanoutEvent endpoint list
 *   - .where().orderBy()                     — processRoutingRules rules list
 *   - .where().limit(1).then(rows => rows[0]) — processRoutingRules endpoint lookup
 */
function makeDb(rowSequences: unknown[][] = []) {
  let callIdx = 0;
  const insertValues = vi.fn().mockResolvedValue(undefined);

  return {
    select: vi.fn().mockImplementation(() => {
      const rows = rowSequences[callIdx] ?? [];
      callIdx++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            // biome-ignore lint/suspicious/noThenProperty: mock needs thenable interface
            then: (resolve: (r: unknown[]) => unknown) =>
              Promise.resolve(resolve(rows as unknown[])),
            orderBy: vi.fn().mockResolvedValue(rows),
            limit: vi.fn().mockReturnValue({
              // biome-ignore lint/suspicious/noThenProperty: mock needs thenable interface
              then: (resolve: (r: unknown[]) => unknown) =>
                Promise.resolve(resolve(rows as unknown[])),
            }),
          }),
        }),
      };
    }),
    insert: vi.fn().mockReturnValue({ values: insertValues }),
    _insertValues: insertValues,
  };
}

function makeQueue() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

// ─── fanoutEvent — basic delivery ─────────────────────────────────────────────

describe('fanoutEvent — basic delivery', () => {
  it('delivers to receiving endpoint and returns one delivery', async () => {
    const db = makeDb([[ep({ id: 'ep_recv' })]]);
    const queue = makeQueue();

    const result = await fanoutEvent(
      db as unknown as Parameters<typeof fanoutEvent>[0],
      queue as unknown as Parameters<typeof fanoutEvent>[1],
      BASE_EVENT,
      'ep_recv',
    );

    expect(result.eventId).toBe('evt_001');
    expect(result.deliveries).toHaveLength(1);
    expect(result.deliveries[0]!.endpointId).toBe('ep_recv');
    expect(result.deliveries[0]!.status).toBe('pending');
  });

  it('calls queue.send once for the receiving endpoint', async () => {
    const db = makeDb([[ep({ id: 'ep_recv' })]]);
    const queue = makeQueue();

    await fanoutEvent(
      db as unknown as Parameters<typeof fanoutEvent>[0],
      queue as unknown as Parameters<typeof fanoutEvent>[1],
      BASE_EVENT,
      'ep_recv',
    );

    expect(queue.send).toHaveBeenCalledTimes(1);
    expect(queue.send).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointId: 'ep_recv',
        eventId: 'evt_001',
        workspaceId: 'ws_001',
        attempt: 1,
      }),
    );
  });

  it('fans out to all active fanout-enabled endpoints', async () => {
    const db = makeDb([[ep({ id: 'ep_1' }), ep({ id: 'ep_2' }), ep({ id: 'ep_3' })]]);
    const queue = makeQueue();

    const result = await fanoutEvent(
      db as unknown as Parameters<typeof fanoutEvent>[0],
      queue as unknown as Parameters<typeof fanoutEvent>[1],
      BASE_EVENT,
      'ep_1',
    );

    expect(result.deliveries).toHaveLength(3);
    expect(queue.send).toHaveBeenCalledTimes(3);
  });

  it('inserts one DB delivery record per eligible endpoint', async () => {
    const db = makeDb([[ep({ id: 'ep_1' }), ep({ id: 'ep_2' })]]);
    const queue = makeQueue();

    await fanoutEvent(
      db as unknown as Parameters<typeof fanoutEvent>[0],
      queue as unknown as Parameters<typeof fanoutEvent>[1],
      BASE_EVENT,
      'ep_1',
    );

    expect(db._insertValues).toHaveBeenCalledTimes(2);
  });
});

// ─── fanoutEvent — fanout filtering ───────────────────────────────────────────

describe('fanoutEvent — fanout filtering', () => {
  it('skips non-receiving endpoint when fanoutEnabled is 0', async () => {
    const db = makeDb([[ep({ id: 'ep_recv' }), ep({ id: 'ep_nofan', fanoutEnabled: 0 })]]);
    const queue = makeQueue();

    const result = await fanoutEvent(
      db as unknown as Parameters<typeof fanoutEvent>[0],
      queue as unknown as Parameters<typeof fanoutEvent>[1],
      BASE_EVENT,
      'ep_recv',
    );

    expect(result.deliveries).toHaveLength(1);
    expect(result.deliveries[0]!.endpointId).toBe('ep_recv');
  });

  it('still delivers to receiving endpoint even when its fanoutEnabled is 0', async () => {
    const db = makeDb([[ep({ id: 'ep_recv', fanoutEnabled: 0 })]]);
    const queue = makeQueue();

    const result = await fanoutEvent(
      db as unknown as Parameters<typeof fanoutEvent>[0],
      queue as unknown as Parameters<typeof fanoutEvent>[1],
      BASE_EVENT,
      'ep_recv',
    );

    expect(result.deliveries).toHaveLength(1);
    expect(result.deliveries[0]!.endpointId).toBe('ep_recv');
  });

  it('delivers to endpoint when its eventTypes filter includes the event type', async () => {
    const db = makeDb([
      [
        ep({ id: 'ep_recv' }),
        ep({ id: 'ep_filtered', eventTypes: JSON.stringify(['order.created', 'order.updated']) }),
      ],
    ]);
    const queue = makeQueue();

    const result = await fanoutEvent(
      db as unknown as Parameters<typeof fanoutEvent>[0],
      queue as unknown as Parameters<typeof fanoutEvent>[1],
      BASE_EVENT,
      'ep_recv',
    );

    expect(result.deliveries).toHaveLength(2);
  });

  it('skips non-receiving endpoint when eventTypes filter excludes the event type', async () => {
    const db = makeDb([
      [
        ep({ id: 'ep_recv' }),
        ep({ id: 'ep_wrong_type', eventTypes: JSON.stringify(['payment.completed']) }),
      ],
    ]);
    const queue = makeQueue();

    const result = await fanoutEvent(
      db as unknown as Parameters<typeof fanoutEvent>[0],
      queue as unknown as Parameters<typeof fanoutEvent>[1],
      BASE_EVENT,
      'ep_recv',
    );

    expect(result.deliveries).toHaveLength(1);
    expect(result.deliveries[0]!.endpointId).toBe('ep_recv');
  });

  it('null eventTypes is a wildcard and receives all event types', async () => {
    const event = { id: 'evt_001', workspaceId: 'ws_001', eventType: 'payment.completed' };
    const db = makeDb([[ep({ id: 'ep_recv' }), ep({ id: 'ep_wildcard', eventTypes: null })]]);
    const queue = makeQueue();

    const result = await fanoutEvent(
      db as unknown as Parameters<typeof fanoutEvent>[0],
      queue as unknown as Parameters<typeof fanoutEvent>[1],
      event,
      'ep_recv',
    );

    expect(result.deliveries).toHaveLength(2);
  });
});

// ─── fanoutEvent — queue and replay ───────────────────────────────────────────

describe('fanoutEvent — queue and replay', () => {
  it('still inserts DB record when no queue is provided', async () => {
    const db = makeDb([[ep({ id: 'ep_recv' })]]);

    const result = await fanoutEvent(
      db as unknown as Parameters<typeof fanoutEvent>[0],
      undefined,
      BASE_EVENT,
      'ep_recv',
    );

    expect(db._insertValues).toHaveBeenCalledTimes(1);
    expect(result.deliveries).toHaveLength(1);
  });

  it('replay mode (no receivingEndpointId): delivers to fanout-enabled endpoints', async () => {
    const db = makeDb([[ep({ id: 'ep_1' }), ep({ id: 'ep_2' })]]);
    const queue = makeQueue();

    const result = await fanoutEvent(
      db as unknown as Parameters<typeof fanoutEvent>[0],
      queue as unknown as Parameters<typeof fanoutEvent>[1],
      BASE_EVENT,
    );

    expect(result.deliveries).toHaveLength(2);
  });

  it('replay mode: skips endpoints with fanoutEnabled=0', async () => {
    const db = makeDb([[ep({ id: 'ep_fan' }), ep({ id: 'ep_nofan', fanoutEnabled: 0 })]]);
    const queue = makeQueue();

    const result = await fanoutEvent(
      db as unknown as Parameters<typeof fanoutEvent>[0],
      queue as unknown as Parameters<typeof fanoutEvent>[1],
      BASE_EVENT,
    );

    expect(result.deliveries).toHaveLength(1);
    expect(result.deliveries[0]!.endpointId).toBe('ep_fan');
  });

  it('adds receiving endpoint as delivery even when not in active endpoint list', async () => {
    const db = makeDb([[]]); // active endpoints query returns empty
    const queue = makeQueue();

    const result = await fanoutEvent(
      db as unknown as Parameters<typeof fanoutEvent>[0],
      queue as unknown as Parameters<typeof fanoutEvent>[1],
      BASE_EVENT,
      'ep_recv_inactive',
    );

    expect(result.deliveries).toHaveLength(1);
    expect(result.deliveries[0]!.endpointId).toBe('ep_recv_inactive');
    expect(db._insertValues).toHaveBeenCalledTimes(1);
  });
});

// ─── processRoutingRules — basic ──────────────────────────────────────────────

describe('processRoutingRules — basic', () => {
  it('returns empty array when no rules exist', async () => {
    const db = makeDb([[]]); // rules query returns empty
    const queue = makeQueue();
    const event = { ...BASE_EVENT, payload: {}, headers: {} };

    const result = await processRoutingRules(
      db as unknown as Parameters<typeof processRoutingRules>[0],
      queue as unknown as Parameters<typeof processRoutingRules>[1],
      event,
    );

    expect(result).toEqual([]);
    expect(queue.send).not.toHaveBeenCalled();
  });

  it('creates delivery when rule matches and endpoint is active', async () => {
    const db = makeDb([[rule()], [ep({ id: 'ep_target' })]]);
    const queue = makeQueue();
    const event = { ...BASE_EVENT, payload: {}, headers: {} };

    const result = await processRoutingRules(
      db as unknown as Parameters<typeof processRoutingRules>[0],
      queue as unknown as Parameters<typeof processRoutingRules>[1],
      event,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.endpointId).toBe('ep_target');
    expect(result[0]!.ruleId).toBe('rule_001');
    expect(result[0]!.status).toBe('pending');
    expect(queue.send).toHaveBeenCalledTimes(1);
  });

  it('skips rule when conditions do not match event type', async () => {
    const nonMatch = rule({
      conditions: JSON.stringify([
        { field: 'event.type', operator: 'equals', value: 'payment.completed' },
      ]),
    });
    const db = makeDb([[nonMatch]]);
    const queue = makeQueue();
    const event = { ...BASE_EVENT, payload: {}, headers: {} };

    const result = await processRoutingRules(
      db as unknown as Parameters<typeof processRoutingRules>[0],
      queue as unknown as Parameters<typeof processRoutingRules>[1],
      event,
    );

    expect(result).toHaveLength(0);
    expect(queue.send).not.toHaveBeenCalled();
  });
});

// ─── processRoutingRules — action types and edge cases ────────────────────────

describe('processRoutingRules — action types and edge cases', () => {
  it('skips delivery when actionType is "drop"', async () => {
    const db = makeDb([[rule({ actionType: 'drop' })]]);
    const queue = makeQueue();
    const event = { ...BASE_EVENT, payload: {}, headers: {} };

    const result = await processRoutingRules(
      db as unknown as Parameters<typeof processRoutingRules>[0],
      queue as unknown as Parameters<typeof processRoutingRules>[1],
      event,
    );

    expect(result).toHaveLength(0);
    expect(db._insertValues).not.toHaveBeenCalled();
  });

  it('skips rule when actionEndpointId is null', async () => {
    const db = makeDb([[rule({ actionEndpointId: null })]]);
    const queue = makeQueue();
    const event = { ...BASE_EVENT, payload: {}, headers: {} };

    const result = await processRoutingRules(
      db as unknown as Parameters<typeof processRoutingRules>[0],
      queue as unknown as Parameters<typeof processRoutingRules>[1],
      event,
    );

    expect(result).toHaveLength(0);
    expect(db._insertValues).not.toHaveBeenCalled();
  });

  it('skips rule when target endpoint is not found or inactive', async () => {
    const db = makeDb([[rule()], []]); // rule matches but endpoint query returns empty
    const queue = makeQueue();
    const event = { ...BASE_EVENT, payload: {}, headers: {} };

    const result = await processRoutingRules(
      db as unknown as Parameters<typeof processRoutingRules>[0],
      queue as unknown as Parameters<typeof processRoutingRules>[1],
      event,
    );

    expect(result).toHaveLength(0);
    expect(db._insertValues).not.toHaveBeenCalled();
  });

  it('handles multiple matching rules and creates independent deliveries', async () => {
    const rule1 = rule({ id: 'rule_001', actionEndpointId: 'ep_target1' });
    const rule2 = rule({ id: 'rule_002', actionEndpointId: 'ep_target2' });
    const db = makeDb([[rule1, rule2], [ep({ id: 'ep_target1' })], [ep({ id: 'ep_target2' })]]);
    const queue = makeQueue();
    const event = { ...BASE_EVENT, payload: {}, headers: {} };

    const result = await processRoutingRules(
      db as unknown as Parameters<typeof processRoutingRules>[0],
      queue as unknown as Parameters<typeof processRoutingRules>[1],
      event,
    );

    expect(result).toHaveLength(2);
    expect(result.map((d) => d.ruleId)).toEqual(['rule_001', 'rule_002']);
    expect(queue.send).toHaveBeenCalledTimes(2);
    expect(db._insertValues).toHaveBeenCalledTimes(2);
  });

  it('skips delivery for no-queue case but still returns delivery records', async () => {
    const db = makeDb([[rule()], [ep({ id: 'ep_target' })]]);
    const event = { ...BASE_EVENT, payload: {}, headers: {} };

    const result = await processRoutingRules(
      db as unknown as Parameters<typeof processRoutingRules>[0],
      undefined,
      event,
    );

    expect(result).toHaveLength(1);
    expect(db._insertValues).toHaveBeenCalledTimes(1);
  });
});
