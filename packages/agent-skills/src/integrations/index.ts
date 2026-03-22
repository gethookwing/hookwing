/**
 * Integration registry for @hookwing/agent-skills
 */

import type { IntegrationRecipe } from '../types.js';

// Import recipes
import stripeRecipe from './stripe/recipe.json' with { type: 'json' };
import githubRecipe from './github/recipe.json' with { type: 'json' };
import shopifyRecipe from './shopify/recipe.json' with { type: 'json' };
import slackRecipe from './slack/recipe.json' with { type: 'json' };
import twilioRecipe from './twilio/recipe.json' with { type: 'json' };
import sendgridRecipe from './sendgrid/recipe.json' with { type: 'json' };

export type { IntegrationRecipe } from '../types.js';

export interface Integration {
  name: string;
  recipe: IntegrationRecipe;
  handler: unknown;
}

// Registry of all available integrations
export const integrations: Record<string, Integration> = {
  stripe: {
    name: 'stripe',
    recipe: stripeRecipe as IntegrationRecipe,
    handler: null, // Lazy-loaded
  },
  github: {
    name: 'github',
    recipe: githubRecipe as IntegrationRecipe,
    handler: null, // Lazy-loaded
  },
  shopify: {
    name: 'shopify',
    recipe: shopifyRecipe as IntegrationRecipe,
    handler: null, // Lazy-loaded
  },
  slack: {
    name: 'slack',
    recipe: slackRecipe as IntegrationRecipe,
    handler: null, // Lazy-loaded
  },
  twilio: {
    name: 'twilio',
    recipe: twilioRecipe as IntegrationRecipe,
    handler: null, // Lazy-loaded
  },
  sendgrid: {
    name: 'sendgrid',
    recipe: sendgridRecipe as IntegrationRecipe,
    handler: null, // Lazy-loaded
  },
};

/**
 * Get integration by name
 */
export function getIntegration(name: string): Integration | undefined {
  return integrations[name.toLowerCase()];
}

/**
 * List all available integrations
 */
export function listIntegrations(): IntegrationRecipe[] {
  return Object.values(integrations).map((i) => i.recipe);
}

/**
 * Get handler for an integration
 */
export async function getHandler(name: string): Promise<unknown> {
  const integration = getIntegration(name);
  if (!integration) {
    throw new Error(`Unknown integration: ${name}`);
  }

  if (integration.handler) {
    return integration.handler;
  }

  // Lazy-load handler
  if (name === 'stripe') {
    const { createStripeHandler } = await import('./stripe/handler.js');
    return createStripeHandler;
  }

  if (name === 'github') {
    const { createGitHubHandler } = await import('./github/handler.js');
    return createGitHubHandler;
  }

  if (name === 'shopify') {
    const { createShopifyHandler } = await import('./shopify/handler.js');
    return createShopifyHandler;
  }

  if (name === 'slack') {
    const { createSlackHandler } = await import('./slack/handler.js');
    return createSlackHandler;
  }

  if (name === 'twilio') {
    const { createTwilioHandler } = await import('./twilio/handler.js');
    return createTwilioHandler;
  }

  if (name === 'sendgrid') {
    const { createSendGridHandler } = await import('./sendgrid/handler.js');
    return createSendGridHandler;
  }

  throw new Error(`Handler not implemented for: ${name}`);
}

export { stripeRecipe, githubRecipe };
