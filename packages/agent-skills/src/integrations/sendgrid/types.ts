/**
 * SendGrid webhook types.
 * @see https://docs.sendgrid.com/for-developers/tracking-events/event
 */

import type { WebhookEvent } from '../../types.js';

export type SendGridEventType =
  | 'processed'
  | 'dropped'
  | 'delivered'
  | 'bounced'
  | 'blocked'
  | 'spam_report'
  | 'unsubscribe'
  | 'click'
  | 'open'
  | 'group_unsubscribe'
  | 'group_resubscribe';

export interface SendGridBaseEvent {
  sg_event_id: string;
  sg_message_id: string;
  event: SendGridEventType;
  email: string;
  timestamp: number;
  'smtp-id'?: string;
  pool?: {
    name: string;
    id: number;
  };
  [key: string]: unknown;
}

export interface SendGridDeliveryEvent extends SendGridBaseEvent {
  event: 'delivered' | 'processed';
  response: string;
}

export interface SendGridBounceEvent extends SendGridBaseEvent {
  event: 'bounced' | 'dropped' | 'blocked';
  status: string;
  reason: string;
  bounced_at?: number;
}

export interface SendGridSpamEvent extends SendGridBaseEvent {
  event: 'spam_report';
}

export interface SendGridClickEvent extends SendGridBaseEvent {
  event: 'click';
  url: string;
  url_offset?: {
    index: number;
    type: string;
  };
}

export interface SendGridOpenEvent extends SendGridBaseEvent {
  event: 'open';
  user_agent?: string;
  ip?: string;
}

export interface SendGridUnsubscribeEvent extends SendGridBaseEvent {
  event: 'unsubscribe' | 'group_unsubscribe' | 'group_resubscribe';
  asm_group_id?: number;
}

export interface SendGridEvent extends WebhookEvent {
  type: SendGridEventType | string;
  data: Record<string, unknown>;
}
