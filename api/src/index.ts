import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { webhooks, webhookDeliveries } from './db/schema';
import type { CreateWebhookRequest, WebhookResponse, DeliveryResponse } from './types';

export interface Env {
	DB: D1Database;
	WEBHOOK_QUEUE: Queue;
}

interface WebhookQueueMessage {
	webhookId: string;
	attempt: number;
}

// POST /webhooks - Create a new webhook
async function handleCreateWebhook(request: Request, env: Env): Promise<Response> {
	const body = await request.json() as CreateWebhookRequest;

	if (!body.destination_url || !body.event_type || !body.payload) {
		return Response.json(
			{ error: 'Missing required fields: destination_url, event_type, payload' },
			{ status: 400 }
		);
	}

	try {
		new URL(body.destination_url);
	} catch {
		return Response.json(
			{ error: 'Invalid destination_url' },
			{ status: 400 }
		);
	}

	const webhookId = crypto.randomUUID();
	const now = Math.floor(Date.now() / 1000);

	const db = drizzle(env.DB);
	await db.insert(webhooks).values({
		id: webhookId,
		payload: typeof body.payload === 'string' ? body.payload : JSON.stringify(body.payload),
		destinationUrl: body.destination_url,
		eventType: body.event_type,
		createdAt: now,
		status: 'pending',
		retryCount: 0,
	}).run();

	await env.WEBHOOK_QUEUE.send({ webhookId, attempt: 1 });

	return Response.json({ id: webhookId, status: 'pending' }, { status: 201 });
}

// GET /webhooks/:id - Get webhook status
async function handleGetWebhook(env: Env, webhookId: string): Promise<Response> {
	const db = drizzle(env.DB);
	const result = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).get();

	if (!result) {
		return Response.json({ error: 'Webhook not found' }, { status: 404 });
	}

	const response: WebhookResponse = {
		id: result.id,
		payload: result.payload,
		destination_url: result.destinationUrl,
		event_type: result.eventType,
		created_at: result.createdAt,
		status: result.status,
		retry_count: result.retryCount,
		next_retry_at: result.nextRetryAt,
		last_error: result.lastError,
	};

	return Response.json(response);
}

// GET /webhooks/:id/deliveries - Get delivery attempts
async function handleGetDeliveries(env: Env, webhookId: string): Promise<Response> {
	const db = drizzle(env.DB);

	const webhook = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).get();
	if (!webhook) {
		return Response.json({ error: 'Webhook not found' }, { status: 404 });
	}

	const deliveries = await db
		.select()
		.from(webhookDeliveries)
		.where(eq(webhookDeliveries.webhookId, webhookId))
		.orderBy(desc(webhookDeliveries.attemptedAt))
		.all();

	const response: DeliveryResponse[] = deliveries.map((d) => ({
		id: d.id,
		webhook_id: d.webhookId,
		attempt_number: d.attemptNumber,
		status: d.status,
		response_code: d.responseCode,
		response_body: d.responseBody,
		error_message: d.errorMessage,
		attempted_at: d.attemptedAt,
	}));

	return Response.json(response);
}

// Queue consumer handler
export async function queueConsumer(
	messages: MessageBatch<WebhookQueueMessage>,
	env: Env,
	ctx: ExecutionContext
): Promise<void> {
	const db = drizzle(env.DB);

	for (const message of messages) {
		const { webhookId, attempt } = message.body;
		const now = Math.floor(Date.now() / 1000);

		try {
			const webhook = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).get();
			if (!webhook || webhook.status === 'delivered') {
				continue;
			}

			await db.update(webhooks).set({ status: 'processing', lastError: null }).where(eq(webhooks.id, webhookId)).run();

			let success = false;
			let responseCode: number | null = null;
			let responseBody: string | null = null;
			let error: string | null = null;

			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 30000);

				const res = await fetch(webhook.destinationUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-Webhook-ID': webhook.id,
						'X-Webhook-Event': webhook.eventType,
						'X-Webhook-Attempt': String(attempt),
					},
					body: webhook.payload,
					signal: controller.signal,
				});

				clearTimeout(timeoutId);
				responseCode = res.status;
				responseBody = await res.text();
				success = res.ok;

				if (!success) {
					error = `HTTP ${res.status}: ${responseBody.substring(0, 500)}`;
				}
			} catch (e) {
				error = e instanceof Error ? e.message : 'Unknown error';
			}

			await db.insert(webhookDeliveries).values({
				id: crypto.randomUUID(),
				webhookId,
				attemptNumber: attempt,
				status: success ? 'success' : 'failed',
				responseCode,
				responseBody,
				errorMessage: error,
				attemptedAt: now,
			}).run();

			if (success) {
				await db.update(webhooks).set({ status: 'delivered', retryCount: attempt }).where(eq(webhooks.id, webhookId)).run();
			} else if (attempt >= 5) {
				await db.update(webhooks).set({ status: 'failed', retryCount: attempt, lastError: error }).where(eq(webhooks.id, webhookId)).run();
			} else {
				const delaySeconds = Math.min(Math.pow(2, attempt) * 60, 3600);
				const nextRetry = Math.floor(Date.now() / 1000) + delaySeconds;
				await db.update(webhooks).set({ status: 'retrying', retryCount: attempt, nextRetryAt: nextRetry, lastError: error }).where(eq(webhooks.id, webhookId)).run();
				await env.WEBHOOK_QUEUE.send({ webhookId, attempt: attempt + 1 }, { delaySeconds });
			}
		} catch (e) {
			const error = e instanceof Error ? e.message : 'Unknown error';
			await db.insert(webhookDeliveries).values({
				id: crypto.randomUUID(),
				webhookId,
				attemptNumber: attempt,
				status: 'failed',
				errorMessage: error,
				attemptedAt: now,
			}).run();

			if (attempt < 5) {
				const delaySeconds = Math.min(Math.pow(2, attempt) * 60, 3600);
				const nextRetry = Math.floor(Date.now() / 1000) + delaySeconds;
				await db.update(webhooks).set({ status: 'retrying', retryCount: attempt, nextRetryAt: nextRetry, lastError: error }).where(eq(webhooks.id, webhookId)).run();
				await env.WEBHOOK_QUEUE.send({ webhookId, attempt: attempt + 1 }, { delaySeconds });
			} else {
				await db.update(webhooks).set({ status: 'failed', retryCount: attempt, lastError: error }).where(eq(webhooks.id, webhookId)).run();
			}
		}
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		if (path === '/webhooks' && request.method === 'POST') {
			return handleCreateWebhook(request, env);
		}

		const webhookMatch = path.match(/^\/webhooks\/([^/]+)$/);
		if (webhookMatch && request.method === 'GET') {
			return handleGetWebhook(env, webhookMatch[1]);
		}

		const deliveriesMatch = path.match(/^\/webhooks\/([^/]+)\/deliveries$/);
		if (deliveriesMatch && request.method === 'GET') {
			return handleGetDeliveries(env, deliveriesMatch[1]);
		}

		if (path === '/health' || path === '/') {
			return Response.json({ status: 'ok' });
		}

		return Response.json({ error: 'Not Found' }, { status: 404 });
	},
} satisfies ExportedHandler<Env>;
