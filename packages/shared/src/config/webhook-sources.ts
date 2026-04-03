/**
 * Pre-configured webhook source definitions.
 *
 * Each source describes a common webhook provider: what event types it sends,
 * how it signs requests, and recommended endpoint configuration. Used by the
 * dashboard and API to simplify setup for known providers.
 */

export interface WebhookSourceEventCategory {
  /** Category name (e.g. "Payments", "Subscriptions") */
  name: string;
  /** Event types in this category */
  eventTypes: string[];
}

export interface WebhookSourceSignature {
  /** Where the signature is sent */
  header: string;
  /** Signature algorithm or format */
  algorithm: string;
  /** Human-readable description of how to verify */
  description: string;
}

export interface WebhookSource {
  /** Unique identifier (lowercase, no spaces) */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** URL to the provider's webhook documentation */
  docsUrl: string;
  /** Logo icon identifier (for dashboard rendering) */
  icon: string;
  /** Event type categories this source sends */
  eventCategories: WebhookSourceEventCategory[];
  /** All known event types (flat list) */
  eventTypes: string[];
  /** Signature verification details */
  signature: WebhookSourceSignature;
  /** Recommended event types for a typical integration */
  recommendedEventTypes: string[];
  /** Setup instructions (short, for dashboard display) */
  setupSteps: string[];
}

export const WEBHOOK_SOURCES: WebhookSource[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing, subscriptions, and billing events.',
    docsUrl: 'https://docs.stripe.com/webhooks',
    icon: 'stripe',
    eventCategories: [
      {
        name: 'Payments',
        eventTypes: [
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
          'payment_intent.created',
          'payment_intent.canceled',
          'charge.succeeded',
          'charge.failed',
          'charge.refunded',
          'charge.dispute.created',
          'charge.dispute.closed',
        ],
      },
      {
        name: 'Subscriptions',
        eventTypes: [
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'customer.subscription.trial_will_end',
          'customer.subscription.paused',
          'customer.subscription.resumed',
        ],
      },
      {
        name: 'Invoices',
        eventTypes: [
          'invoice.paid',
          'invoice.payment_failed',
          'invoice.finalized',
          'invoice.upcoming',
          'invoice.created',
        ],
      },
      {
        name: 'Customers',
        eventTypes: [
          'customer.created',
          'customer.updated',
          'customer.deleted',
        ],
      },
      {
        name: 'Checkout',
        eventTypes: [
          'checkout.session.completed',
          'checkout.session.expired',
          'checkout.session.async_payment_succeeded',
          'checkout.session.async_payment_failed',
        ],
      },
    ],
    eventTypes: [
      'payment_intent.succeeded', 'payment_intent.payment_failed', 'payment_intent.created',
      'payment_intent.canceled', 'charge.succeeded', 'charge.failed', 'charge.refunded',
      'charge.dispute.created', 'charge.dispute.closed',
      'customer.subscription.created', 'customer.subscription.updated',
      'customer.subscription.deleted', 'customer.subscription.trial_will_end',
      'customer.subscription.paused', 'customer.subscription.resumed',
      'invoice.paid', 'invoice.payment_failed', 'invoice.finalized', 'invoice.upcoming',
      'invoice.created', 'customer.created', 'customer.updated', 'customer.deleted',
      'checkout.session.completed', 'checkout.session.expired',
      'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed',
    ],
    signature: {
      header: 'Stripe-Signature',
      algorithm: 'HMAC-SHA256 with timestamp (t=...,v1=...)',
      description: 'Stripe signs with HMAC-SHA256 using a per-endpoint secret. The signature header contains a timestamp and one or more versioned signatures.',
    },
    recommendedEventTypes: [
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.paid',
      'invoice.payment_failed',
      'checkout.session.completed',
    ],
    setupSteps: [
      'Go to Stripe Dashboard → Developers → Webhooks',
      'Click "Add endpoint" and paste your Hookwing ingest URL',
      'Select the event types you want to receive',
      'Copy the signing secret — you\'ll need it for signature verification',
    ],
  },

  {
    id: 'github',
    name: 'GitHub',
    description: 'Repository events, pull requests, issues, deployments, and CI/CD.',
    docsUrl: 'https://docs.github.com/en/webhooks',
    icon: 'github',
    eventCategories: [
      {
        name: 'Pull Requests',
        eventTypes: [
          'pull_request.opened',
          'pull_request.closed',
          'pull_request.merged',
          'pull_request.reopened',
          'pull_request.synchronize',
          'pull_request_review.submitted',
          'pull_request_review_comment.created',
        ],
      },
      {
        name: 'Issues',
        eventTypes: [
          'issues.opened',
          'issues.closed',
          'issues.edited',
          'issues.labeled',
          'issue_comment.created',
        ],
      },
      {
        name: 'Push & Branches',
        eventTypes: [
          'push',
          'create',
          'delete',
          'branch_protection_rule.created',
          'branch_protection_rule.edited',
        ],
      },
      {
        name: 'CI/CD',
        eventTypes: [
          'workflow_run.completed',
          'workflow_run.requested',
          'check_run.completed',
          'check_suite.completed',
          'deployment.created',
          'deployment_status.created',
        ],
      },
      {
        name: 'Releases',
        eventTypes: [
          'release.published',
          'release.created',
          'release.edited',
          'release.deleted',
        ],
      },
    ],
    eventTypes: [
      'pull_request.opened', 'pull_request.closed', 'pull_request.merged',
      'pull_request.reopened', 'pull_request.synchronize',
      'pull_request_review.submitted', 'pull_request_review_comment.created',
      'issues.opened', 'issues.closed', 'issues.edited', 'issues.labeled',
      'issue_comment.created', 'push', 'create', 'delete',
      'branch_protection_rule.created', 'branch_protection_rule.edited',
      'workflow_run.completed', 'workflow_run.requested',
      'check_run.completed', 'check_suite.completed',
      'deployment.created', 'deployment_status.created',
      'release.published', 'release.created', 'release.edited', 'release.deleted',
    ],
    signature: {
      header: 'X-Hub-Signature-256',
      algorithm: 'HMAC-SHA256',
      description: 'GitHub signs the payload with HMAC-SHA256 using the webhook secret. The header value is prefixed with "sha256=".',
    },
    recommendedEventTypes: [
      'pull_request.opened',
      'pull_request.closed',
      'push',
      'issues.opened',
      'workflow_run.completed',
      'release.published',
    ],
    setupSteps: [
      'Go to your repository → Settings → Webhooks → Add webhook',
      'Paste your Hookwing ingest URL as the Payload URL',
      'Set Content type to "application/json"',
      'Enter a secret (save it for signature verification)',
      'Select individual events or "Send me everything"',
    ],
  },

  {
    id: 'shopify',
    name: 'Shopify',
    description: 'E-commerce events: orders, products, customers, and inventory.',
    docsUrl: 'https://shopify.dev/docs/apps/build/webhooks',
    icon: 'shopify',
    eventCategories: [
      {
        name: 'Orders',
        eventTypes: [
          'orders/create',
          'orders/updated',
          'orders/paid',
          'orders/fulfilled',
          'orders/cancelled',
          'orders/partially_fulfilled',
          'refunds/create',
        ],
      },
      {
        name: 'Products',
        eventTypes: [
          'products/create',
          'products/update',
          'products/delete',
          'inventory_levels/update',
          'inventory_levels/connect',
        ],
      },
      {
        name: 'Customers',
        eventTypes: [
          'customers/create',
          'customers/update',
          'customers/delete',
          'customers/enable',
          'customers/disable',
        ],
      },
      {
        name: 'Checkouts',
        eventTypes: [
          'checkouts/create',
          'checkouts/update',
          'carts/create',
          'carts/update',
        ],
      },
      {
        name: 'Fulfillment',
        eventTypes: [
          'fulfillments/create',
          'fulfillments/update',
          'fulfillment_events/create',
        ],
      },
    ],
    eventTypes: [
      'orders/create', 'orders/updated', 'orders/paid', 'orders/fulfilled',
      'orders/cancelled', 'orders/partially_fulfilled', 'refunds/create',
      'products/create', 'products/update', 'products/delete',
      'inventory_levels/update', 'inventory_levels/connect',
      'customers/create', 'customers/update', 'customers/delete',
      'customers/enable', 'customers/disable',
      'checkouts/create', 'checkouts/update', 'carts/create', 'carts/update',
      'fulfillments/create', 'fulfillments/update', 'fulfillment_events/create',
    ],
    signature: {
      header: 'X-Shopify-Hmac-Sha256',
      algorithm: 'HMAC-SHA256 (base64-encoded)',
      description: 'Shopify signs the payload body with HMAC-SHA256 using the app secret key. The signature is base64-encoded.',
    },
    recommendedEventTypes: [
      'orders/create',
      'orders/paid',
      'orders/fulfilled',
      'orders/cancelled',
      'products/update',
      'customers/create',
      'inventory_levels/update',
    ],
    setupSteps: [
      'Go to your Shopify Admin → Settings → Notifications → Webhooks',
      'Click "Create webhook"',
      'Select the event type and set format to JSON',
      'Paste your Hookwing ingest URL',
      'Note the HMAC verification key shown at the top of the Webhooks page',
    ],
  },

  {
    id: 'linear',
    name: 'Linear',
    description: 'Project management events: issues, projects, comments, and cycles.',
    docsUrl: 'https://developers.linear.app/docs/graphql/webhooks',
    icon: 'linear',
    eventCategories: [
      {
        name: 'Issues',
        eventTypes: [
          'Issue.create',
          'Issue.update',
          'Issue.remove',
        ],
      },
      {
        name: 'Comments',
        eventTypes: [
          'Comment.create',
          'Comment.update',
          'Comment.remove',
        ],
      },
      {
        name: 'Projects',
        eventTypes: [
          'Project.create',
          'Project.update',
          'Project.remove',
        ],
      },
      {
        name: 'Cycles',
        eventTypes: [
          'Cycle.create',
          'Cycle.update',
          'Cycle.remove',
        ],
      },
      {
        name: 'Labels',
        eventTypes: [
          'IssueLabel.create',
          'IssueLabel.update',
          'IssueLabel.remove',
        ],
      },
    ],
    eventTypes: [
      'Issue.create', 'Issue.update', 'Issue.remove',
      'Comment.create', 'Comment.update', 'Comment.remove',
      'Project.create', 'Project.update', 'Project.remove',
      'Cycle.create', 'Cycle.update', 'Cycle.remove',
      'IssueLabel.create', 'IssueLabel.update', 'IssueLabel.remove',
    ],
    signature: {
      header: 'Linear-Signature',
      algorithm: 'HMAC-SHA256 (hex-encoded)',
      description: 'Linear signs the payload with HMAC-SHA256 using the webhook signing secret. The header value is hex-encoded.',
    },
    recommendedEventTypes: [
      'Issue.create',
      'Issue.update',
      'Comment.create',
      'Project.update',
      'Cycle.update',
    ],
    setupSteps: [
      'Go to Linear → Settings → API → Webhooks',
      'Click "New webhook"',
      'Paste your Hookwing ingest URL',
      'Select the resource types you want to subscribe to',
      'Save and copy the signing secret',
    ],
  },
];

/** Look up a webhook source by ID */
export function getWebhookSource(id: string): WebhookSource | undefined {
  return WEBHOOK_SOURCES.find((s) => s.id === id);
}

/** Get all available webhook source IDs */
export function getWebhookSourceIds(): string[] {
  return WEBHOOK_SOURCES.map((s) => s.id);
}
