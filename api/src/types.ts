export interface WebhookQueueMessage {
	webhookId: string;
}

export interface CreateWebhookRequest {
	destination_url: string;
	payload: string;
	event_type: string;
}

export interface WebhookResponse {
	id: string;
	payload: string;
	destination_url: string;
	event_type: string;
	created_at: number;
	status: string;
	retry_count: number;
	next_retry_at: number | null;
	last_error: string | null;
}

export interface DeliveryResponse {
	id: string;
	webhook_id: string;
	attempt_number: number;
	status: string;
	response_code: number | null;
	response_body: string | null;
	error_message: string | null;
	attempted_at: number;
}
