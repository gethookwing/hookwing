# Webhook Delivery

Hookwing uses at-least-once delivery with retry controls.

## Reliability model

- Exponential backoff retries
- Jitter to reduce retry storms
- Dead-letter handling for exhausted events
- Replay support for recovery

## Best practices

- Implement idempotency on consumers
- Monitor retry depth and failure rates
- Alert on sustained delivery degradation
