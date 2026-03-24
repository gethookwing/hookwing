---
title: "SDK Quickstart"
slug: "sdk-quickstart"
summary: "Get started with the Hookwing SDK in Node.js, Python, Go, or Ruby. Verify webhook signatures in under 5 minutes."
updatedAt: "2026-03-24"
---

## Choose Your Language

Hookwing has official SDKs for 4 languages. Each handles HMAC-SHA256 signature verification with constant-time comparison.

## Node.js / TypeScript

### Install

```bash
npm install @hookwing/sdk
```

### Verify Webhooks

```javascript
import { Webhook } from '@hookwing/sdk';

const wh = new Webhook('whsec_your_signing_secret');

// Express example
app.post('/webhooks', async (req, res) => {
  try {
    const event = await wh.verify(req.body, {
      signature: req.headers['x-hookwing-signature'],
      timestamp: req.headers['x-hookwing-timestamp'],
    });

    console.log(`Event: ${event.type}`, event.payload);

    switch (event.type) {
      case 'order.created':
        await handleOrder(event.payload);
        break;
      case 'payment.succeeded':
        await handlePayment(event.payload);
        break;
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    res.status(401).send('Invalid signature');
  }
});
```

## Python

### Install

```bash
pip install hookwing
```

### Verify Webhooks

```python
from hookwing import Webhook, WebhookVerificationError

wh = Webhook('whsec_your_signing_secret')

# Flask example
@app.route('/webhooks', methods=['POST'])
def handle_webhook():
    try:
        event = wh.verify(
            request.data.decode('utf-8'),
            {
                'signature': request.headers.get('x-hookwing-signature'),
                'timestamp': request.headers.get('x-hookwing-timestamp'),
            }
        )

        print(f"Event: {event.type}")

        if event.type == 'order.created':
            handle_order(event.payload)

        return 'OK', 200

    except WebhookVerificationError as e:
        print(f"Verification failed: {e}")
        return str(e), 401
```

### Async API Client

```python
from hookwing import HookwingClient

async with HookwingClient(api_key='hk_live_...') as client:
    endpoints = await client.list_endpoints()
    events = await client.list_events(limit=10)
    
    endpoint = await client.create_endpoint(
        url='https://my-app.com/webhooks',
        name='production',
    )
```

## Go

### Install

```bash
go get github.com/gethookwing/hookwing-go
```

### Verify Webhooks

```go
package main

import (
    "fmt"
    "io"
    "net/http"
    hookwing "github.com/gethookwing/hookwing-go"
)

func main() {
    wh := hookwing.NewWebhook("whsec_your_signing_secret")

    http.HandleFunc("/webhooks", func(w http.ResponseWriter, r *http.Request) {
        body, _ := io.ReadAll(r.Body)
        
        event, err := wh.Verify(body, r.Header)
        if err != nil {
            http.Error(w, "Invalid signature", 401)
            return
        }

        fmt.Printf("Event: %s\n", event.Type)
        w.WriteHeader(200)
    })

    http.ListenAndServe(":8080", nil)
}
```

## Ruby

### Install

```bash
gem install hookwing
```

### Verify Webhooks

```ruby
require 'hookwing'

wh = Hookwing::Webhook.new('whsec_your_signing_secret')

# Sinatra example
post '/webhooks' do
  payload = request.body.read
  
  begin
    event = wh.verify(payload, {
      'x-hookwing-signature' => request.env['HTTP_X_HOOKWING_SIGNATURE'],
      'x-hookwing-timestamp' => request.env['HTTP_X_HOOKWING_TIMESTAMP'],
    })

    puts "Event: #{event[:type]}"
    status 200

  rescue Hookwing::VerificationError => e
    puts "Verification failed: #{e.message}"
    status 401
  end
end
```

## Signature Headers

All SDKs verify these two headers:

| Header | Format | Example |
|--------|--------|---------|
| `X-Hookwing-Signature` | `sha256=<hex>` | `sha256=a1b2c3...` |
| `X-Hookwing-Timestamp` | Unix ms | `1774000000000` |

The SDK checks:
1. Timestamp is within 5 minutes (prevents replay attacks)
2. HMAC-SHA256 matches (constant-time comparison)

## Next Steps

- [API Documentation](/docs/) — full endpoint reference
- [Webhook Signatures](/docs/webhooks/) — deep dive on verification
- [Error Codes](/docs/error-codes/) — troubleshooting
