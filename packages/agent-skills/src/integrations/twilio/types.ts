/**
 * Twilio webhook types.
 * @see https://www.twilio.com/docs/usage/webhooks
 */

import type { WebhookEvent } from '../../types.js';

export type TwilioEventType =
  | 'received'
  | 'sent'
  | 'delivered'
  | 'undelivered'
  | 'failed'
  | 'queued'
  | 'initiated'
  | 'ringing'
  | 'answered'
  | 'busy'
  | 'no_answer'
  | 'canceled'
  | 'completed'
  | 'incoming';

export interface TwilioSmsStatus {
  MessageSid: string;
  AccountSid: string;
  MessageStatus: 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  To: string;
  From: string;
  Body?: string;
  NumMedia?: string;
  [key: string]: unknown;
}

export interface TwilioCallStatus {
  CallSid: string;
  AccountSid: string;
  CallStatus:
    | 'queued'
    | 'ringing'
    | 'in-progress'
    | 'busy'
    | 'no-answer'
    | 'canceled'
    | 'completed'
    | 'failed';
  To: string;
  From: string;
  Duration?: string;
  ForwardedFrom?: string;
  [key: string]: unknown;
}

export interface TwilioRecordingStatus {
  RecordingSid: string;
  RecordingUrl: string;
  CallSid: string;
  RecordingStatus: 'completed' | 'in-progress' | 'failed';
  RecordingDuration?: string;
  [key: string]: unknown;
}

export interface TwilioEvent extends WebhookEvent {
  type: TwilioEventType | string;
  data: Record<string, unknown>;
}
