# Hookwing Go SDK

Go SDK for Hookwing webhook signature verification and typed API client.

## Installation

```bash
go get github.com/gethookwing/hookwing-go
```

## Webhook Verification

Verify incoming webhook signatures with HMAC-SHA256:

```go
package main

import (
    "io"
    "net/http"

    hookwing "github.com/gethookwing/hookwing-go"
)

func main() {
    wh := hookwing.NewWebhook("whsec_your_signing_secret")

    http.HandleFunc("/webhook", func(w http.ResponseWriter, r *http.Request) {
        payload, _ := io.ReadAll(r.Body)

        event, err := wh.Verify(payload, r.Header)
        if err != nil {
            http.Error(w, err.Error(), http.StatusBadRequest)
            return
        }

        // Handle the verified event
        println("Received event:", event.Type)
    })
}
```

### Headers

- `X-Hookwing-Signature`: HMAC-SHA256 signature (format: `sha256=<hex>`)
- `X-Hookwing-Timestamp`: Unix timestamp in milliseconds
- `X-Event-Type`: Event type (optional, falls back to payload type)

### Options

```go
// Set custom tolerance (default: 5 minutes)
wh := hookwing.NewWebhook("secret", hookwing.WithToleranceMs(10*60*1000))
```

## API Client

Manage endpoints, events, and deliveries:

```go
package main

import (
    "context"

    hookwing "github.com/gethookwing/hookwing-go"
)

func main() {
    client := hookwing.NewClient("your-api-key")

    // List endpoints
    endpoints, _ := client.ListEndpoints(context.Background())

    // Create endpoint
    endpoint, _ := client.CreateEndpoint(context.Background(), hookwing.CreateEndpointRequest{
        Name: "My Endpoint",
        URL:  "https://example.com/webhook",
    })

    // List events
    events, _ := client.ListEvents(context.Background(), hookwing.WithLimit(50))

    // Replay event
    client.ReplayEvent(context.Background(), "evt_123")
}
```

### Options

```go
// Custom base URL
client := hookwing.NewClient("api-key", hookwing.WithBaseURL("https://api.hookwing.com"))

// Custom HTTP client
client := hookwing.NewClient("api-key", hookwing.WithHTTPClient(&http.Client{Timeout: 60*time.Second}))
```

## Testing

```bash
go test ./...
```
