# Hookwing Python SDK

Webhook signature verification + typed API client for Python.

## Installation

```bash
pip install hookwing
```

## Webhook Verification

Verify incoming webhooks from Hookwing:

```python
import asyncio
from hookwing import Webhook

wh = Webhook('whsec_your_signing_secret')

async def handle_webhook(request):
    payload = await request.text()
    signature = request.headers.get('X-Hookwing-Signature')
    timestamp = request.headers.get('X-Hookwing-Timestamp')

    event = await wh.verify(payload, {
        'signature': signature,
        'timestamp': timestamp,
    })

    # Process the verified event
    print(f"Received {event.type} event: {event.id}")
    return {"status": "ok"}

# For Flask
@app.route('/webhook', methods=['POST'])
async def webhook():
    return await handle_webhook(request)

# For FastAPI
@app.post('/webhook')
async def webhook(request: Request):
    return await handle_webhook(request)
```

### Header Constants

```python
from hookwing import SIGNATURE_HEADER, TIMESTAMP_HEADER, EVENT_TYPE_HEADER
# x-hookwing-signature, x-hookwing-timestamp, x-event-type
```

### Custom Tolerance

```python
# 1 minute tolerance instead of default 5 minutes
wh = Webhook('whsec_secret', tolerance_ms=60_000)
```

## API Client

Manage endpoints, events, and deliveries:

```python
import asyncio
from hookwing import HookwingClient

async def main():
    client = HookwingClient("your-api-key")

    # List endpoints
    endpoints = await client.list_endpoints()

    # Create endpoint
    endpoint = await client.create_endpoint(
        name="My Endpoint",
        url="https://example.com/webhook",
        events=["order.created", "order.updated"],
    )

    # Get event
    event = await client.get_event("evt_123")

    # Replay failed event
    await client.replay_event("evt_123")

    # List deliveries
    deliveries = await client.list_deliveries(status="failed")

    await client.close()

asyncio.run(main())
```

## Requirements

- Python 3.9+
- httpx 0.24+

## License

MIT
