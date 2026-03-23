/**
 * Stripe-specific types
 */

export interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
    previous_attributes?: Record<string, unknown>;
  };
  created: number;
  livemode: boolean;
  request?: {
    id: string;
    idempotency_key: string;
  };
  api_version: string;
}

export interface StripeWebhookConfig {
  signingSecret: string;
  toleranceSeconds?: number;
}

export type StripeEventHandler = (event: StripeEvent) => Promise<void>;

export interface StripeHandler {
  verify: (payload: string, signatureHeader: string) => StripeEvent;
  handle: (
    event: StripeEvent,
    handlers: Partial<Record<string, StripeEventHandler>>,
  ) => Promise<void>;
}

// Common Stripe event types
export type StripeEventType =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.created'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.created'
  | 'invoice.updated'
  | 'charge.succeeded'
  | 'charge.failed'
  | 'charge.refunded'
  | 'product.created'
  | 'product.updated'
  | 'price.created'
  | 'price.updated'
  | 'checkout.session.completed'
  | 'checkout.session.expired'
  | 'customer_portal.session.created';
