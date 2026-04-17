/**
 * Pure OTel config utilities — no Cloudflare-runtime dependencies.
 * Used by both the Worker and Node.js unit tests.
 */

export interface OtelEnv {
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_AUTH_TOKEN?: string;
  OTEL_SAMPLE_RATE?: string;
}

export function parseSampleRate(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 0.1;
  const n = parseFloat(raw);
  if (isNaN(n)) return 0.1;
  return Math.min(1, Math.max(0, n));
}

export function parseOtelConfig(env: OtelEnv): {
  endpoint: string | null;
  authToken: string | null;
  sampleRate: number;
} {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || null;
  const authToken = env.OTEL_AUTH_TOKEN?.trim() || null;
  const sampleRate = parseSampleRate(env.OTEL_SAMPLE_RATE);
  return { endpoint, authToken, sampleRate };
}
