/**
 * Hookwing API helpers for auto-provisioning webhook endpoints
 */

import { type IntegrationRecipe, getIntegration } from './integrations/index.js';

export interface ProvisionEndpointOptions {
  apiKey: string;
  integration: string;
  url: string;
  baseUrl?: string;
}

export interface EndpointResponse {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  secret: string;
  createdAt: string;
}

/**
 * Provision a webhook endpoint on Hookwing for an integration
 *
 * @param options - Configuration for endpoint provisioning
 * @returns Created endpoint details
 */
export async function provisionEndpoint(
  options: ProvisionEndpointOptions,
): Promise<EndpointResponse> {
  const { apiKey, integration, url, baseUrl = 'https://api.hookwing.com' } = options;

  const recipe = getIntegration(integration)?.recipe;
  if (!recipe) {
    throw new Error(
      `Unknown integration: ${integration}. Available: ${listAvailableIntegrations()}`,
    );
  }

  const res = await fetch(`${baseUrl}/v1/endpoints`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: recipe.hookwing.endpointName,
      url,
      eventTypes: recipe.hookwing.eventTypes,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to provision endpoint: ${res.status} ${error}`);
  }

  return res.json() as Promise<EndpointResponse>;
}

/**
 * List all endpoints on Hookwing
 *
 * @param options - Configuration for listing endpoints
 * @returns List of endpoints
 */
export async function listEndpoints(options: { apiKey: string; baseUrl?: string }): Promise<
  EndpointResponse[]
> {
  const { apiKey, baseUrl = 'https://api.hookwing.com' } = options;

  const res = await fetch(`${baseUrl}/v1/endpoints`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to list endpoints: ${res.status}`);
  }

  return res.json() as Promise<EndpointResponse[]>;
}

/**
 * Delete an endpoint on Hookwing
 *
 * @param options - Configuration for deleting an endpoint
 */
export async function deleteEndpoint(options: {
  apiKey: string;
  endpointId: string;
  baseUrl?: string;
}): Promise<void> {
  const { apiKey, endpointId, baseUrl = 'https://api.hookwing.com' } = options;

  const res = await fetch(`${baseUrl}/v1/endpoints/${endpointId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to delete endpoint: ${res.status}`);
  }
}

/**
 * Get the recipe for an integration
 */
export function getRecipe(integration: string): IntegrationRecipe | undefined {
  return getIntegration(integration)?.recipe;
}

/**
 * List available integration names
 */
export function listAvailableIntegrations(): string {
  return 'stripe, github';
}

export { getIntegration, listIntegrations } from './integrations/index.js';
export type { IntegrationRecipe } from './integrations/index.js';
