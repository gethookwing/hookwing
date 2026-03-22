# SendGrid Integration

Webhook handler for SendGrid.

## Signature Verification

SendGrid uses HMAC-SHA256 with `X-Twilio-Email-Event-Webhook-Signature` and `X-Twilio-Email-Event-Webhook-Timestamp` headers. The signature is base64 encoded.

```typescript
import { createSendGridHandler } from '@hookwing/agent-skills/sendgrid';

const handler = createSendGridHandler({
  signingSecret: process.env.SENDGRID_SIGNING_KEY!,
});

// In your webhook endpoint
app.post('/webhooks/sendgrid', async (req) => {
  const signature = req.headers['x-twilio-email-event-webhook-signature'];
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'];
  const event = handler.verify(req.body, signature, timestamp);

  await handler.handle(event, {
    'delivered': async (e) => { /* handle delivery */ },
    'bounced': async (e) => { /* handle bounce */ },
    'open': async (e) => { /* handle open tracking */ },
    'click': async (e) => { /* handle click tracking */ },
    'spam_report': async (e) => { /* handle spam report */ },
  });
});
```

## Common Events

- `processed` - Email processed by SendGrid
- `delivered` - Email delivered to recipient
- `bounced` - Email bounced
- `dropped` - Email dropped (invalid recipient, etc.)
- `blocked` - Email blocked
- `spam_report` - Recipient marked as spam
- `open` - Recipient opened email (if open tracking enabled)
- `click` - Recipient clicked a link (if click tracking enabled)
- `unsubscribe` - Recipient unsubscribed
- `group_unsubscribe` - Recipient unsubscribed from a group
- `group_resubscribe` - Recipient resubscribed to a group

## Setup

1. Get your signing key:
   - Go to https://console.sendgrid.com
   - Settings > Mail Settings > Event Webhook
   - Or: Settings > Partner Settings > Twilio SendGrid > Event Webhook

2. Generate a signing key:
   - Click "Generate Signing Key"
   - Save the key securely

3. Configure webhook URL:
   - Enter your webhook endpoint URL
   - Select events to track

4. Enable tracking in your emails:
   - Open tracking: Add `<% tracking_meta_data %>` to your email template
   - Click tracking: Automatically enabled for tracked links

5. Add the signing key to your environment variables.
