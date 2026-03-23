/**
 * Shopify webhook types.
 * @see https://shopify.dev/docs/api/webhooks
 */

import type { WebhookEvent } from '../../types.js';

export type ShopifyTopic =
  | 'orders/create'
  | 'orders/paid'
  | 'orders/fulfilled'
  | 'orders/cancelled'
  | 'products/create'
  | 'products/update'
  | 'products/delete'
  | 'customers/create'
  | 'customers/update'
  | 'checkouts/create'
  | 'checkouts/update'
  | 'refunds/create';

export interface ShopifyOrder {
  id: number;
  order_number: number;
  email: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  created_at: string;
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
  }>;
  [key: string]: unknown;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  created_at: string;
  orders_count: number;
  [key: string]: unknown;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  handle: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ShopifyCheckout {
  id: number;
  token: string;
  email: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ShopifyEvent extends WebhookEvent {
  type: ShopifyTopic | string;
  data: Record<string, unknown>;
}
