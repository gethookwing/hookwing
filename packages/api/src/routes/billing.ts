import { workspaces } from '@hookwing/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { z } from 'zod';
import { createDb } from '../db';
import { authMiddleware, getWorkspace, requireApiKeyScopes } from '../middleware/auth';

type BillingBindings = {
  DB?: D1Database;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ID_WARBIRD?: string;
  STRIPE_PRICE_ID_STEALTH_JET?: string;
  APP_URL?: string;
};

const billing = new Hono<{ Bindings: BillingBindings }>();

// Helper: Get Stripe client (returns null if no secret key)
function getStripe(env: BillingBindings): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) {
    return null;
  }
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });
}

// Helper: Map price ID to tier slug
function tierFromPriceId(priceId: string, env: BillingBindings): string | null {
  if (priceId === env.STRIPE_PRICE_ID_WARBIRD) return 'warbird';
  if (priceId === env.STRIPE_PRICE_ID_STEALTH_JET) return 'stealth-jet';
  return null;
}

// Helper: Get price ID from tier slug
function priceIdFromTier(tier: string, env: BillingBindings): string | null {
  if (tier === 'warbird') return env.STRIPE_PRICE_ID_WARBIRD ?? null;
  if (tier === 'stealth-jet') return env.STRIPE_PRICE_ID_STEALTH_JET ?? null;
  return null;
}

// Helper: Get current period end timestamp (30 days from now as fallback)
function getCurrentPeriodEnd(subscription: Stripe.Subscription): number {
  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
  return Math.floor((periodEnd ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60) * 1000);
}

// ============================================================================
// POST /checkout — Create Stripe Checkout session
// ============================================================================

const checkoutSchema = z.object({
  targetTier: z.enum(['warbird', 'stealth-jet']),
});

billing.post('/checkout', authMiddleware, async (c) => {
  const env = c.env;
  const stripe = getStripe(env);

  if (!stripe) {
    return c.json({ error: 'Billing not configured' }, 503);
  }

  const workspace = await getWorkspace(c);
  if (!workspace) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const parsed = checkoutSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }

  const { targetTier } = parsed.data;
  const priceId = priceIdFromTier(targetTier, env);

  if (!priceId) {
    return c.json({ error: 'Invalid tier' }, 400);
  }

  const appUrl = env.APP_URL ?? 'https://hookwing.com';
  const successUrl = `${appUrl}/settings/billing?success=true`;
  const cancelUrl = `${appUrl}/settings/billing?canceled=true`;

  // If workspace already has a Stripe customer, attach to existing
  let customerId = workspace.stripeCustomerId ?? undefined;
  let customer: Stripe.Customer | undefined;

  if (!customerId) {
    customer = await stripe.customers.create({
      email: workspace.email ?? undefined,
      metadata: {
        workspaceId: workspace.id,
      },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        workspaceId: workspace.id,
      },
    },
    metadata: {
      workspaceId: workspace.id,
    },
  });

  // Update workspace with stripeCustomerId if newly created
  if (!workspace.stripeCustomerId && customer) {
    const db = createDb(env.DB as D1Database);
    await db
      .update(workspaces)
      .set({ stripeCustomerId: customer.id })
      .where(eq(workspaces.id, workspace.id));
  }

  return c.json({ checkoutUrl: session.url });
});

// ============================================================================
// GET /portal — Create Stripe Customer Portal session
// ============================================================================

billing.get('/portal', authMiddleware, async (c) => {
  const env = c.env;
  const stripe = getStripe(env);

  if (!stripe) {
    return c.json({ error: 'Billing not configured' }, 503);
  }

  const workspace = await getWorkspace(c);
  if (!workspace) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!workspace.stripeCustomerId) {
    return c.json({ error: 'No billing account', checkoutUrl: '/settings/billing' }, 400);
  }

  const appUrl = env.APP_URL ?? 'https://hookwing.com';
  const returnUrl = `${appUrl}/settings/billing`;

  const session = await stripe.billingPortal.sessions.create({
    customer: workspace.stripeCustomerId,
    return_url: returnUrl,
  });

  return c.json({ portalUrl: session.url });
});

// ============================================================================
// POST /upgrade — Upgrade subscription (requires billing:upgrade scope)
// ============================================================================

const upgradeSchema = z.object({
  targetTier: z.enum(['warbird', 'stealth-jet']),
});

billing.post('/upgrade', authMiddleware, requireApiKeyScopes(['billing:upgrade']), async (c) => {
  const env = c.env;
  const stripe = getStripe(env);

  if (!stripe) {
    return c.json({ error: 'Billing not configured' }, 503);
  }

  const workspace = await getWorkspace(c);
  if (!workspace) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Check 1: agentUpgradeBehavior must not be 'disabled'
  if (workspace.agentUpgradeBehavior === 'disabled') {
    return c.json({ error: 'agent_upgrade_disabled' }, 403);
  }

  // Check 3: must have an active subscription
  if (!workspace.stripeSubscriptionId) {
    // Create checkout URL for the user to add payment method
    const appUrl = env.APP_URL ?? 'https://hookwing.com';
    const checkoutUrl = `${appUrl}/settings/billing`;

    return c.json({ error: 'payment_method_required', checkoutUrl }, 402);
  }

  const parsed = upgradeSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }

  const { targetTier } = parsed.data;
  const newPriceId = priceIdFromTier(targetTier, env);

  if (!newPriceId) {
    return c.json({ error: 'Invalid tier' }, 400);
  }

  try {
    // Get the subscription
    const subscription = await stripe.subscriptions.retrieve(workspace.stripeSubscriptionId);

    // Update the subscription to the new price
    await stripe.subscriptions.update(workspace.stripeSubscriptionId, {
      items: [
        {
          id: subscription.items.data[0]?.id ?? '',
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
    });

    // Update workspace tier slug
    const newTier = tierFromPriceId(newPriceId, env);
    if (newTier) {
      const db = createDb(env.DB as D1Database);
      await db.update(workspaces).set({ tierSlug: newTier }).where(eq(workspaces.id, workspace.id));
    }

    return c.json({
      ok: true,
      tier: targetTier,
      effectiveAt: getCurrentPeriodEnd(subscription),
    });
  } catch (error) {
    console.error('Upgrade error:', error);
    return c.json({ error: 'Upgrade failed' }, 500);
  }
});

// ============================================================================
// POST /downgrade — Schedule downgrade at period end
// ============================================================================

const downgradeSchema = z.object({
  targetTier: z.enum(['paper-plane', 'warbird']),
});

billing.post('/downgrade', authMiddleware, requireApiKeyScopes(['billing:upgrade']), async (c) => {
  const env = c.env;
  const stripe = getStripe(env);

  if (!stripe) {
    return c.json({ error: 'Billing not configured' }, 503);
  }

  const workspace = await getWorkspace(c);
  if (!workspace) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Check: must have an active subscription
  if (!workspace.stripeSubscriptionId) {
    return c.json({ error: 'No subscription' }, 400);
  }

  const parsed = downgradeSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }

  const { targetTier } = parsed.data;

  try {
    // Get the subscription
    const subscription = await stripe.subscriptions.retrieve(workspace.stripeSubscriptionId);

    // Calculate the new price
    let newPriceId: string | null = null;
    if (targetTier === 'warbird') {
      newPriceId = env.STRIPE_PRICE_ID_WARBIRD ?? null;
    }

    if (!newPriceId) {
      // Downgrading to free tier - cancel at period end
      await stripe.subscriptions.update(workspace.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      return c.json({
        ok: true,
        effectiveAt: getCurrentPeriodEnd(subscription),
      });
    }

    // Downgrading to paid tier - update subscription
    await stripe.subscriptions.update(workspace.stripeSubscriptionId, {
      items: [
        {
          id: subscription.items.data[0]?.id ?? '',
          price: newPriceId,
        },
      ],
      cancel_at_period_end: true, // Also schedule cancellation after downgrade
    });

    const newTier = tierFromPriceId(newPriceId, env);
    if (newTier) {
      const db = createDb(env.DB as D1Database);
      await db.update(workspaces).set({ tierSlug: newTier }).where(eq(workspaces.id, workspace.id));
    }

    return c.json({
      ok: true,
      effectiveAt: getCurrentPeriodEnd(subscription),
    });
  } catch (error) {
    console.error('Downgrade error:', error);
    return c.json({ error: 'Downgrade failed' }, 500);
  }
});

// ============================================================================
// GET /status — Get current billing status
// ============================================================================

billing.get('/status', authMiddleware, requireApiKeyScopes(['billing:read']), async (c) => {
  const env = c.env;
  const stripe = getStripe(env);

  const workspace = await getWorkspace(c);
  if (!workspace) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let subscription: {
    status: string;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
  } | null = null;

  if (stripe && workspace.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(workspace.stripeSubscriptionId);
      subscription = {
        status: sub.status,
        currentPeriodEnd: getCurrentPeriodEnd(sub),
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      };
    } catch (error) {
      console.error('Error fetching subscription:', error);
      // Subscription might not exist anymore
    }
  }

  return c.json({
    tier: workspace.tierSlug,
    subscription,
    agentUpgradeBehavior: workspace.agentUpgradeBehavior,
  });
});

// ============================================================================
// PATCH /settings — Update agent upgrade behavior
// ============================================================================

const settingsSchema = z.object({
  agentUpgradeBehavior: z.enum(['disabled', 'notify', 'enabled']),
});

billing.patch('/settings', authMiddleware, requireApiKeyScopes(['workspace:write']), async (c) => {
  const env = c.env;
  const db = createDb(env.DB as D1Database);

  const workspace = await getWorkspace(c);
  if (!workspace) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const parsed = settingsSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }

  const { agentUpgradeBehavior } = parsed.data;

  await db.update(workspaces).set({ agentUpgradeBehavior }).where(eq(workspaces.id, workspace.id));

  return c.json({ ok: true, agentUpgradeBehavior });
});

// ============================================================================
// POST /webhook — Handle Stripe webhooks (PUBLIC - no auth)
// ============================================================================

billing.post('/webhook', async (c) => {
  const env = c.env;
  const stripe = getStripe(env);

  if (!stripe) {
    console.error('Stripe not configured, cannot process webhook');
    return c.json({ error: 'Webhook not configured' }, 503);
  }

  const signature = c.req.header('Stripe-Signature');
  if (!signature) {
    return c.json({ error: 'Missing Stripe-Signature header' }, 400);
  }

  let event: Stripe.Event;

  try {
    const body = await c.req.text();
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET ?? '');
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return c.json({ error: 'Invalid signature' }, 400);
  }

  const db = createDb(env.DB as D1Database);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.metadata?.workspaceId;

        if (!workspaceId) {
          console.error('Checkout session missing workspaceId');
          break;
        }

        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Get subscription to determine tier
        let tierSlug = 'paper-plane';
        if (subscriptionId) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const priceId = subscription.items.data[0]?.price.id;
            if (priceId) {
              tierSlug = tierFromPriceId(priceId, env) ?? 'paper-plane';
            }
          } catch (error) {
            console.error('Error fetching subscription:', error);
          }
        }

        await db
          .update(workspaces)
          .set({
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            tierSlug,
          })
          .where(eq(workspaces.id, workspaceId));
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find workspace by customer ID
        const [workspace] = await db
          .select()
          .from(workspaces)
          .where(eq(workspaces.stripeCustomerId, customerId))
          .limit(1);

        if (!workspace) {
          console.error('Subscription update: workspace not found for customer', customerId);
          break;
        }

        const priceId = subscription.items.data[0]?.price.id ?? '';
        const newTier = tierFromPriceId(priceId, env);

        if (newTier) {
          await db
            .update(workspaces)
            .set({
              tierSlug: newTier,
              stripeSubscriptionId: subscription.id,
            })
            .where(eq(workspaces.id, workspace.id));
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find workspace by customer ID
        const [workspace] = await db
          .select()
          .from(workspaces)
          .where(eq(workspaces.stripeCustomerId, customerId))
          .limit(1);

        if (!workspace) {
          console.error('Subscription deleted: workspace not found for customer', customerId);
          break;
        }

        await db
          .update(workspaces)
          .set({
            tierSlug: 'paper-plane',
            stripeSubscriptionId: null,
          })
          .where(eq(workspaces.id, workspace.id));
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Log warning - don't change tier
        console.warn('Payment failed for customer:', customerId);
        break;
      }

      default:
        console.log('Unhandled webhook event type:', event.type);
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }

  return c.json({ received: true });
});

export default billing;
