import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ============================================================================
// Workspaces - tenant/org accounts
// ============================================================================

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  tierSlug: text('tier_slug').notNull().default('paper-plane'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

// ============================================================================
// API Keys - authentication keys per workspace
// ============================================================================

export const apiKeys = sqliteTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    scopes: text('scopes'), // JSON array of allowed scopes
    lastUsedAt: integer('last_used_at'),
    expiresAt: integer('expires_at'),
    isActive: integer('is_active').notNull().default(1),
    createdAt: integer('created_at').notNull(),
  },
  (table) => {
    return {
      workspaceIdIdx: index('api_keys_workspace_id_idx').on(table.workspaceId),
      keyPrefixIdx: index('api_keys_key_prefix_idx').on(table.keyPrefix),
    };
  },
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

// ============================================================================
// Endpoints - webhook destinations
// ============================================================================

export const endpoints = sqliteTable(
  'endpoints',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    description: text('description'),
    secret: text('secret').notNull(),
    eventTypes: text('event_types'), // JSON array of subscribed event types
    isActive: integer('is_active').notNull().default(1),
    fanoutEnabled: integer('fanout_enabled').notNull().default(1), // Opt-out of receiving fan-out events
    rateLimitPerSecond: integer('rate_limit_per_second'),
    metadata: text('metadata'), // JSON object
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => {
    return {
      workspaceIdIdx: index('endpoints_workspace_id_idx').on(table.workspaceId),
    };
  },
);

export type Endpoint = typeof endpoints.$inferSelect;
export type NewEndpoint = typeof endpoints.$inferInsert;

// ============================================================================
// Events - incoming webhook events
// ============================================================================

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payload: text('payload').notNull(), // JSON stringified body
    headers: text('headers'), // JSON stringified headers
    sourceIp: text('source_ip'),
    receivedAt: integer('received_at').notNull(),
    processedAt: integer('processed_at'),
    status: text('status').notNull().default('pending'), // pending, processing, completed, failed
  },
  (table) => {
    return {
      workspaceReceivedAtIdx: index('events_workspace_received_at_idx').on(
        table.workspaceId,
        table.receivedAt,
      ),
      workspaceStatusIdx: index('events_workspace_status_idx').on(table.workspaceId, table.status),
    };
  },
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

// ============================================================================
// Deliveries - delivery attempts per event per endpoint
// ============================================================================

export const deliveries = sqliteTable(
  'deliveries',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    endpointId: text('endpoint_id')
      .notNull()
      .references(() => endpoints.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull().default(1),
    status: text('status').notNull().default('pending'), // pending, success, failed, retrying
    responseStatusCode: integer('response_status_code'),
    responseBody: text('response_body'), // First 1KB
    responseHeaders: text('response_headers'), // JSON
    errorMessage: text('error_message'),
    durationMs: integer('duration_ms'),
    nextRetryAt: integer('next_retry_at'),
    deliveredAt: integer('delivered_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => {
    return {
      eventIdIdx: index('deliveries_event_id_idx').on(table.eventId),
      endpointIdIdx: index('deliveries_endpoint_id_idx').on(table.endpointId),
      workspaceCreatedAtIdx: index('deliveries_workspace_created_at_idx').on(
        table.workspaceId,
        table.createdAt,
      ),
      statusNextRetryAtIdx: index('deliveries_status_next_retry_at_idx').on(
        table.status,
        table.nextRetryAt,
      ),
    };
  },
);

export type Delivery = typeof deliveries.$inferSelect;
export type NewDelivery = typeof deliveries.$inferInsert;

// ============================================================================
// Usage Daily - daily usage tracking for billing/limits
// ============================================================================

export const usageDaily = sqliteTable(
  'usage_daily',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    date: text('date').notNull(), // YYYY-MM-DD format
    eventsReceived: integer('events_received').notNull().default(0),
    deliveriesAttempted: integer('deliveries_attempted').notNull().default(0),
    deliveriesSucceeded: integer('deliveries_succeeded').notNull().default(0),
    deliveriesFailed: integer('deliveries_failed').notNull().default(0),
  },
  (table) => {
    return {
      workspaceDateIdx: uniqueIndex('usage_daily_workspace_date_idx').on(
        table.workspaceId,
        table.date,
      ),
    };
  },
);

export type UsageDaily = typeof usageDaily.$inferSelect;
export type NewUsageDaily = typeof usageDaily.$inferInsert;
