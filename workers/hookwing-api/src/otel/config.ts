import {
  type ResolveConfigFn,
  multiTailSampler,
  isHeadSampled,
  isRootErrorSpan,
} from '@microlabs/otel-cf-workers';

export type { OtelEnv } from './config-base';
export { parseSampleRate, parseOtelConfig } from './config-base';
import type { OtelEnv } from './config-base';
import { parseOtelConfig } from './config-base';

export const resolveConfig: ResolveConfigFn<OtelEnv> = (env) => {
  const { endpoint, authToken, sampleRate } = parseOtelConfig(env);

  const headers: Record<string, string> = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const exporterUrl = endpoint ?? 'http://localhost:4318/v1/traces';

  return {
    exporter: { url: exporterUrl, headers },
    service: { name: 'hookwing-api' },
    // Outbound fetch calls include W3C traceparent/tracestate headers
    fetch: { includeTraceContext: true },
    sampling: {
      // Head-based: sample at configured rate (default 10%)
      headSampler: { ratio: sampleRate },
      // Tail-based override: always keep error spans regardless of head decision
      tailSampler: multiTailSampler([isHeadSampled, isRootErrorSpan]),
    },
  };
};
