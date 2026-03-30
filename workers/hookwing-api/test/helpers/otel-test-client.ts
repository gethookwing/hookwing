/**
 * Helper for querying the span-asserter service in contract tests.
 */

export interface StoredSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  attributes: Record<string, unknown>;
  status: { code: number; message?: string };
  links: unknown[];
}

export class OTelTestClient {
  constructor(private asserterUrl: string) {}

  async clearSpans(): Promise<void> {
    await fetch(`${this.asserterUrl}/spans`, { method: 'DELETE' });
  }

  async getSpans(filters?: {
    name?: string;
    traceId?: string;
    attr?: Record<string, string>;
  }): Promise<StoredSpan[]> {
    const params = new URLSearchParams();
    if (filters?.name) params.set('name', filters.name);
    if (filters?.traceId) params.set('traceId', filters.traceId);
    if (filters?.attr) {
      for (const [k, v] of Object.entries(filters.attr)) {
        params.set(`attr.${k}`, v);
      }
    }
    const res = await fetch(`${this.asserterUrl}/spans?${params}`);
    const data = await res.json() as { spans: StoredSpan[] };
    return data.spans;
  }

  async waitForSpans(
    filters: { name?: string; minCount?: number; attr?: Record<string, string> },
    timeoutMs = 10000,
    pollMs = 300
  ): Promise<StoredSpan[]> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const spans = await this.getSpans(filters);
      if (spans.length >= (filters.minCount ?? 1)) return spans;
      await new Promise(r => setTimeout(r, pollMs));
    }
    throw new Error(
      `Timed out after ${timeoutMs}ms waiting for spans matching ${JSON.stringify(filters)}`
    );
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.asserterUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
