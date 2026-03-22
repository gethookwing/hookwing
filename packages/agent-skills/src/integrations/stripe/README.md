# Stripe Integration

Handle Stripe webhook events with signature verification.

## Installation

```bash
npm install @hookwing/agent-skills
```

## Usage

```typescript
import { createStripeHandler } from '@hookwing/agent-skills/stripe';

const handler = createStripeHandler({
  signingSecret: process.env.STRIPE_WEBHOOK_SECRET,
  toleranceSeconds: 300, // optional, default 5 minutes
});

// In your webhook route handler:
app.post('/webhooks/stripe', async (req) => {
  const event = handler.verify(
    JSON.stringify(req.body),
    req.headers['stripe-signature']
  );

  await handler.handle(event, {
    'payment_intent.succeeded': async (event) => {
      console.log('Payment succeeded:', event.data.object);
    },
    'payment_intent.payment_failed': async (event) => {
      console.log('Payment failed:', event.data.object);
    },
  });
});
```

## Signature Verification

This handler implements real HMAC-SHA256 signature verification using Node.js crypto:

1. Extracts timestamp (`t`) and signature (`v1`) from `Stripe-Signature` header
2. Verifies timestamp is within tolerance (default 5 minutes)
3. Computes expected HMAC-SHA256 of `${timestamp}.${payload}`
4. Uses `timingSafeEqual` to prevent timing attacks

## Events Supported

- `payment_intent.succeeded` - Payment successful
- `payment_intent.payment_failed` - Payment failed
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Subscription changed
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.paid` - Invoice paid
- `invoice.payment_failed` - Invoice payment failed
- `charge.refunded` - Charge refunded
- `checkout.session.completed` - Checkout completed
