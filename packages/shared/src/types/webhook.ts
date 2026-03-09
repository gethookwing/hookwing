export type WebhookDeliveryStatus =
  | 'pending'
  | 'delivered'
  | 'failed'
  | 'retrying';

export interface WebhookEvent {
  id: string;
  source: string;
  destination_id: string;
  event_type: string;
  payload: unknown;
  headers: Record<string, string>;
  created_at: string;
  delivered_at?: string;
  attempt_count: number;
  status: WebhookDeliveryStatus;
}

export interface WebhookDestination {
  id: string;
  workspace_id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}
