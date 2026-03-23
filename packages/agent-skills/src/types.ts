/**
 * Shared types for @hookwing/agent-skills
 */

export interface IntegrationRecipe {
  name: string;
  displayName: string;
  description: string;
  signatureHeader: string;
  signatureMethod: string;
  commonEvents: string[];
  hookwing: {
    endpointName: string;
    eventTypes: string[];
  };
}

export interface WebhookHandlerConfig {
  signingSecret: string;
  toleranceSeconds?: number;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  created?: number;
}

export type EventHandler<T extends WebhookEvent = WebhookEvent> = (event: T) => Promise<void>;

export interface HandlerFactory<T extends WebhookEvent = WebhookEvent> {
  verify: (payload: string, signatureHeader: string) => T;
  handle: (event: T, handlers: Partial<Record<string, EventHandler<T>>>) => Promise<void>;
}
