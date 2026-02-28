import { drizzle } from 'drizzle-orm/d1';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const webhooks = sqliteTable('webhooks', {
	id: text('id').primaryKey(),
	payload: text('payload').notNull(),
	destinationUrl: text('destination_url').notNull(),
	eventType: text('event_type').notNull(),
	createdAt: integer('created_at').notNull().default(Math.floor(Date.now() / 1000)),
	status: text('status').notNull().default('pending'),
	retryCount: integer('retry_count').notNull().default(0),
	nextRetryAt: integer('next_retry_at'),
	lastError: text('last_error'),
});

export const webhookDeliveries = sqliteTable('webhook_deliveries', {
	id: text('id').primaryKey(),
	webhookId: text('webhook_id').notNull(),
	attemptNumber: integer('attempt_number').notNull(),
	status: text('status').notNull(),
	responseCode: integer('response_code'),
	responseBody: text('response_body'),
	errorMessage: text('error_message'),
	attemptedAt: integer('attempted_at').notNull().default(Math.floor(Date.now() / 1000)),
});

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;

export type WebhookStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'retrying';
export type DeliveryStatus = 'success' | 'failed' | 'pending';

export function getDb(env: { DB: D1Database }) {
	return drizzle(env.DB);
}
