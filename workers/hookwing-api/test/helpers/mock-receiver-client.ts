/**
 * Helper for querying the mock-receiver service in contract tests.
 */

export interface RecordedDelivery {
  method: string;
  pathname: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
  traceparent: string | null;
  tracestate: string | null;
}

export class MockReceiverClient {
  constructor(private receiverUrl: string) {}

  async clearDeliveries(): Promise<void> {
    await fetch(`${this.receiverUrl}/deliveries`, { method: 'DELETE' });
  }

  async getDeliveries(): Promise<RecordedDelivery[]> {
    const res = await fetch(`${this.receiverUrl}/deliveries`);
    const data = await res.json() as { deliveries: RecordedDelivery[] };
    return data.deliveries;
  }

  async waitForDeliveries(minCount = 1, timeoutMs = 10000, pollMs = 300): Promise<RecordedDelivery[]> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const deliveries = await this.getDeliveries();
      if (deliveries.length >= minCount) return deliveries;
      await new Promise(r => setTimeout(r, pollMs));
    }
    throw new Error(`Timed out waiting for ${minCount} deliveries`);
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.receiverUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
