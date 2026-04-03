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
  agentUpgradeBehavior: text('agent_upgrade_behavior').notNull().default('disabled'),
  isPlayground: integer('is_playground').notNull().default(0), // 1 for temporary playground sessions
  captchaEnabled: integer('captcha_enabled').notNull().default(0), // 1 when CAPTCHA (Turnstile) is enabled
  totpSecret: text('totp_secret'), // Encrypted TOTP secret for 2FA
  totpEnabled: integer('totp_enabled').notNull().default(0), // 1 when TOTP 2FA is enabled
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
    sourceId: text('source_id'), // Webhook source preset ID (e.g. 'stripe', 'github')
    eventTypes: text('event_types'), // JSON array of subscribed event types
    isActive: integer('is_active').notNull().default(1),
    fanoutEnabled: integer('fanout_enabled').notNull().default(1), // Opt-out of receiving fan-out events
    rateLimitPerSecond: integer('rate_limit_per_second'),
    metadata: text('metadata'), // JSON object
    customHeaders: text('custom_headers'), // JSON object of custom headers
    ipWhitelist: text('ip_whitelist'), // JSON array of allowed IPs/CIDRs
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
    traceId: text('trace_id'), // W3C Trace Context trace ID
    spanId: text('span_id'), // W3C Trace Context span ID
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
    priority: integer('priority').notNull().default(0), // Higher = more priority (Warbird+ get priority 1)
    traceId: text('trace_id'), // W3C Trace Context trace ID
    spanId: text('span_id'), // W3C Trace Context span ID
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

// ============================================================================
// OAuth Accounts - social login identities
// ============================================================================

export const oauthAccounts = sqliteTable(
  'oauth_accounts',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'github' or 'google'
    providerAccountId: text('provider_account_id').notNull(),
    email: text('email'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => {
    return {
      workspaceIdIdx: index('oauth_accounts_workspace_id_idx').on(table.workspaceId),
      providerAccountIdIdx: uniqueIndex('oauth_accounts_provider_account_idx').on(
        table.provider,
        table.providerAccountId,
      ),
    };
  },
);

export type OauthAccount = typeof oauthAccounts.$inferSelect;
export type NewOauthAccount = typeof oauthAccounts.$inferInsert;

// ============================================================================
// Dead Letter Items - failed deliveries queued for later inspection/replay
// ============================================================================

export const deadLetterItems = sqliteTable(
  'dead_letter_items',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    eventId: text('event_id').notNull(),
    endpointId: text('endpoint_id').notNull(),
    deliveryId: text('delivery_id').notNull(),
    errorMessage: text('error_message'),
    attempts: integer('attempts').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    replayedAt: integer('replayed_at'),
    status: text('status').notNull().default('pending'), // pending, replayed
  },
  (table) => {
    return {
      workspaceIdIdx: index('dlq_workspace_idx').on(table.workspaceId),
      statusIdx: index('dlq_status_idx').on(table.status),
    };
  },
);

export type DeadLetterItem = typeof deadLetterItems.$inferSelect;
export type NewDeadLetterItem = typeof deadLetterItems.$inferInsert;

// ============================================================================
// Custom Domains - custom domains for workspace webhooks
// ============================================================================

export const customDomains = sqliteTable(
  'custom_domains',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull().unique(),
    status: text('status').notNull().default('pending'), // pending, verified, failed
    verifiedAt: integer('verified_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => {
    return {
      workspaceIdIdx: index('custom_domains_workspace_idx').on(table.workspaceId),
      domainIdx: index('custom_domains_domain_idx').on(table.domain),
    };
  },
);

export type CustomDomain = typeof customDomains.$inferSelect;
export type NewCustomDomain = typeof customDomains.$inferInsert;

// ============================================================================
// Feedback - user feedback from UI widget or API
// ============================================================================

export const feedback = sqliteTable(
  'feedback',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id'),
    source: text('source').notNull().default('api'), // 'ui' or 'api'
    category: text('category').notNull().default('general'), // bug, feature, ux, docs, general
    rating: integer('rating'), // 1-5
    message: text('message'),
    metadata: text('metadata'), // JSON object
    context: text('context'), // JSON object
    pageUrl: text('page_url'),
    userAgent: text('user_agent'),
    accountTier: text('account_tier'),
    createdAt: integer('created_at').notNull(),
    resolvedAt: integer('resolved_at'),
  },
  (table) => {
    return {
      workspaceIdIdx: index('feedback_workspace_idx').on(table.workspaceId),
      categoryIdx: index('feedback_category_idx').on(table.category),
      createdAtIdx: index('feedback_created_idx').on(table.createdAt),
    };
  },
);

export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;

// ============================================================================
// Password Reset Tokens - password reset tokens
// ============================================================================

export const passwordResetTokens = sqliteTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at').notNull(),
    usedAt: integer('used_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => {
    return {
      workspaceIdIdx: index('idx_prt_workspace').on(table.workspaceId),
      tokenHashIdx: index('idx_prt_token').on(table.tokenHash),
    };
  },
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ============================================================================
// Idempotency Keys - 24-hour deduplication for event ingestion
// ============================================================================

export const idempotencyKeys = sqliteTable(
  'idempotency_keys',
  {
    key: text('key').primaryKey(),
    endpointId: text('endpoint_id').notNull(),
    eventId: text('event_id').notNull(),
    response: text('response').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => {
    return {
      createdAtIdx: index('idx_idem_created').on(table.createdAt),
      endpointIdIdx: index('idx_idem_endpoint').on(table.endpointId),
    };
  },
);

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;

// ============================================================================
// Routing Rules - event routing & filtering rules
// ============================================================================

export const routingRules = sqliteTable(
  'routing_rules',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    priority: integer('priority').notNull().default(0),
    conditions: text('conditions').notNull(), // JSON array of conditions
    actionType: text('action_type').notNull().default('deliver'),
    actionEndpointId: text('action_endpoint_id'),
    actionTransform: text('action_transform'), // JSON transform config
    enabled: integer('enabled').notNull().default(1),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => {
    return {
      workspaceIdIdx: index('routing_rules_workspace_id_idx').on(table.workspaceId),
      priorityIdx: index('routing_rules_priority_idx').on(table.priority),
    };
  },
);

export type RoutingRule = typeof routingRules.$inferSelect;
export type NewRoutingRule = typeof routingRules.$inferInsert;

// ============================================================================
// Workspace OTel Settings - customer-managed observability configuration
// ============================================================================

export const workspaceOtelSettings = sqliteTable('workspace_otel_settings', {
  workspaceId: text('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  otlpEndpoint: text('otlp_endpoint').notNull(),
  otlpHeaders: text('otlp_headers'), // JSON object of headers
  enabled: integer('enabled').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type WorkspaceOtelSettings = typeof workspaceOtelSettings.$inferSelect;
export type NewWorkspaceOtelSettings = typeof workspaceOtelSettings.$inferInsert;
