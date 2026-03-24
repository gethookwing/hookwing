---
title: "Webhook Signatures"
slug: "webhooks"
summary: "How Hookwing signs deliveries and how to verify them in your application."
updatedAt: "2026-03-24"
---

## How Hookwing Signs Deliveries

Every webhook delivery includes two verification headers:

| Header | Value |
|--------|-------|
| `X-Hookwing-Signature` | `sha256=<hex-encoded HMAC-SHA256>` |
| `X-Hookwing-Timestamp` | Unix timestamp in milliseconds |

The signature is computed over the raw request body using your endpoint's signing secret.

### Verification Steps

1. Extract the signature and timestamp from headers
2. Check the timestamp is within 5 minutes of current time (prevents replay attacks)
3. Compute `HMAC-SHA256(signing_secret, request_body)` and compare to the signature
4. Use constant-time comparison to prevent timing attacks

### SDK Verification

**Node.js** (`npm install @hookwing/sdk`):
```javascript
import { Webhook } from '@hookwing/sdk';

const wh = new Webhook('whsec_your_secret');

app.post('/webhooks', async (req, res) => {
  try {
    const event = await wh.verify(req.body, {
      signature: req.headers['x-hookwing-signature'],
      timestamp: req.headers['x-hookwing-timestamp']
    });
    // event.payload contains the verified data
    console.log('Verified event:', event.type, event.payload);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Verification failed:', err.message);
    res.status(401).send('Invalid signature');
  }
});
```

**Python** (`pip install hookwing`):
```python
from hookwing import Webhook, WebhookVerificationError

wh = Webhook('whsec_your_secret')

@app.route('/webhooks', methods=['POST'])
def handle_webhook():
    try:
        event = wh.verify(request.data, {
            'signature': request.headers.get('x-hookwing-signature'),
            'timestamp': request.headers.get('x-hookwing-timestamp')
        })
        print(f"Verified: {event.type}")
        return 'OK', 200
    except WebhookVerificationError as e:
        return str(e), 401
```

**Go** (`go get github.com/gethookwing/hookwing-go`):
```go
wh := hookwing.NewWebhook("whsec_your_secret")

func handleWebhook(w http.ResponseWriter, r *http.Request) {
    body, _ := io.ReadAll(r.Body)
    event, err := wh.Verify(body, r.Header)
    if err != nil {
        http.Error(w, "Invalid signature", 401)
        return
    }
    fmt.Printf("Verified: %s\n", event.Type)
    w.WriteHeader(200)
}
```

**Ruby** (`gem install hookwing`):
```ruby
wh = Hookwing::Webhook.new('whsec_your_secret')

post '/webhooks' do
  event = wh.verify(request.body.read, request.env)
  puts "Verified: #{event[:type]}"
  status 200
rescue Hookwing::VerificationError => e
  status 401
  body e.message
end
```

## Delivery Retries

If your endpoint returns a non-2xx status code, Hookwing retries with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | ~30 seconds |
| 3 | ~2 minutes |
| 4 | ~8 minutes |
| 5 | ~30 minutes |
| 6 | ~2 hours |

After all retries are exhausted, the delivery moves to the Dead Letter Queue (Warbird+ tiers).

## Event Replay

Replay failed or missed events:

```bash
# Replay a single event
curl -X POST https://api.hookwing.com/v1/events/evt_abc/replay \
  -H "Authorization: Bearer hk_live_your_key"
```
