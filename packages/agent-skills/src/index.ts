/**
 * @hookwing/agent-skills
 *
 * Pre-baked webhook handler templates for AI coding agents.
 * Stripe, GitHub, and more integrations with real signature verification.
 */

// Shared types
export type {
  IntegrationRecipe,
  WebhookHandlerConfig,
  WebhookEvent,
  EventHandler,
  HandlerFactory,
} from './types.js';

// Integration registry
export {
  integrations,
  getIntegration,
  listIntegrations,
  getHandler,
  stripeRecipe,
  githubRecipe,
} from './integrations/index.js';

// Stripe integration
export {
  createStripeHandler,
  verifyStripeSignature,
  type StripeEvent,
  type StripeWebhookConfig,
  type StripeHandler,
  type StripeEventHandler,
} from './integrations/stripe/handler.js';

// GitHub integration
export {
  createGitHubHandler,
  verifyGitHubSignature,
  type GitHubEvent,
  type GitHubWebhookConfig,
  type GitHubHandler,
  type GitHubEventHandler,
} from './integrations/github/handler.js';

// Hookwing helpers
export {
  provisionEndpoint,
  listEndpoints,
  deleteEndpoint,
  getRecipe,
  listAvailableIntegrations,
  type ProvisionEndpointOptions,
  type EndpointResponse,
} from './hookwing.js';
