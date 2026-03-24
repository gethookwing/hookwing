# Hookwing Webhook Best Practices

## Description
Best practices for building reliable webhook integrations: signature verification, retry handling, idempotency, and testing strategies.

## When to Use
- Setting up webhook receivers
- Implementing signature verification
- Handling retries and failures
- Making webhook handlers idempotent
- Testing webhook integrations

## Signature Verification

Always verify webhook signatures before processing. Hookwing uses HMAC-SHA256:

```typescript
import { Webhook } from '@hookwing/sdk';

const wh = new Webhook('whsec_your_secret');

app.post('/webhooks', async (req, res) => {
  const event = await wh.verify(req.body, {
    signature: req.headers['x-hookwing-signature'],
    timestamp: req.headers['x-hookwing-timestamp'],
  });
  // Process verified event
});
```

### Key Rules
1. **Never skip verification** — even in development
2. **Use constant-time comparison** — prevents timing attacks (SDKs handle this)
3. **Check timestamp freshness** — reject events older than 5 minutes (replay protection)
4. **Store the signing secret securely** — environment variables, not code

## Retry Handling

Hookwing retries failed deliveries with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | ~30s |
| 3 | ~2min |
| 4 | ~8min |
| 5 | ~30min |
| 6 | ~2h |

### Your handler should:
- Return 2xx quickly (within 30 seconds)
- Process asynchronously if work takes longer
- Return 4xx for permanent failures (Hookwing won't retry)
- Return 5xx for temporary failures (Hookwing will retry)

## Idempotency

Webhooks may be delivered more than once. Make your handler idempotent:

```typescript
app.post('/webhooks', async (req, res) => {
  const event = await wh.verify(req.body, headers);

  // Check if already processed
  const existing = await db.get('processed_events', event.id);
  if (existing) return res.status(200).send('Already processed');

  // Process the event
  await processEvent(event);

  // Mark as processed
  await db.set('processed_events', event.id, { processedAt: Date.now() });

  res.status(200).send('OK');
});
```

### Use the `Idempotency-Key` header on ingest:
```bash
curl -X POST https://api.hookwing.com/v1/ingest/ep_abc \
  -H "Idempotency-Key: order-123-created" \
  -d '{"event": "order.created"}'
```

## Testing

### Local testing with the playground
```bash
# No account needed
curl -X POST https://api.hookwing.com/v1/playground/sessions \
  -H "Content-Type: application/json"
```

### Testing with the CLI
```bash
hookwing events replay evt_abc123  # Re-deliver an event
hookwing deliveries list --status failed  # Check failures
```

## SDKs
- **Node.js**: `npm install @hookwing/sdk`
- **Python**: `pip install hookwing`
- **Go**: `go get github.com/gethookwing/hookwing-go`
- **Ruby**: `gem install hookwing`

## Resources
- [API Docs](https://hookwing.com/docs/)
- [Error Codes](https://hookwing.com/docs/error-codes/)
- [SDK Quickstart](https://hookwing.com/docs/sdk-quickstart/)
