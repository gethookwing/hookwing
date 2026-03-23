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
  shopifyRecipe,
  slackRecipe,
  twilioRecipe,
  sendgridRecipe,
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

// Shopify integration
export {
  createShopifyHandler,
  verifyShopifySignature,
  type ShopifyEvent,
} from './integrations/shopify/handler.js';

// Slack integration
export {
  createSlackHandler,
  verifySlackSignature,
  type SlackEvent,
} from './integrations/slack/handler.js';

// Twilio integration
export {
  createTwilioHandler,
  verifyTwilioSignature,
  type TwilioEvent,
} from './integrations/twilio/handler.js';

// SendGrid integration
export {
  createSendGridHandler,
  verifySendGridSignature,
  type SendGridEvent,
} from './integrations/sendgrid/handler.js';

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
