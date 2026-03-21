package hookwing

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	// SignatureHeader is the header name for the webhook signature.
	SignatureHeader = "X-Hookwing-Signature"
	// TimestampHeader is the header name for the webhook timestamp.
	TimestampHeader = "X-Hookwing-Timestamp"
	// EventTypeHeader is the header name for the event type.
	EventTypeHeader = "X-Event-Type"

	// DefaultToleranceMs is the default tolerance for timestamp verification (5 minutes).
	DefaultToleranceMs int64 = 5 * 60 * 1000
)

// WebhookVerificationError represents an error during webhook verification.
type WebhookVerificationError struct {
	Message string
}

func (e *WebhookVerificationError) Error() string {
	return e.Message
}

// WebhookOption is a functional option for configuring a Webhook.
type WebhookOption func(*Webhook)

// WithToleranceMs sets the tolerance for timestamp verification in milliseconds.
func WithToleranceMs(toleranceMs int64) WebhookOption {
	return func(w *Webhook) {
		w.toleranceMs = toleranceMs
	}
}

// Webhook verifies HMAC-SHA256 signatures on incoming webhook deliveries.
type Webhook struct {
	secret      string
	toleranceMs int64
}

// NewWebhook creates a new Webhook verifier.
func NewWebhook(secret string, opts ...WebhookOption) *Webhook {
	// Strip 'whsec_' prefix if present
	secret = strings.TrimPrefix(secret, "whsec_")

	w := &Webhook{
		secret:      secret,
		toleranceMs: DefaultToleranceMs,
	}

	for _, opt := range opts {
		opt(w)
	}

	return w
}

// Verify verifies a webhook payload and returns the parsed event.
func (w *Webhook) Verify(payload []byte, headers http.Header) (*WebhookEvent, error) {
	signature := headers.Get(SignatureHeader)
	timestamp := headers.Get(TimestampHeader)

	if signature == "" {
		return nil, &WebhookVerificationError{Message: "Missing X-Hookwing-Signature header"}
	}
	if timestamp == "" {
		return nil, &WebhookVerificationError{Message: "Missing X-Hookwing-Timestamp header"}
	}

	// Validate timestamp format
	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return nil, &WebhookVerificationError{Message: "Invalid X-Hookwing-Timestamp header"}
	}

	// Check timestamp staleness
	now := time.Now().UnixMilli()
	age := now - ts
	if age < 0 {
		age = -age
	}
	if age > w.toleranceMs {
		return nil, &WebhookVerificationError{
			Message: fmt.Sprintf("Webhook timestamp too old (%ds ago, tolerance: %ds)",
				age/1000, w.toleranceMs/1000),
		}
	}

	// Verify HMAC signature
	if !w.VerifySignature(payload, signature) {
		return nil, &WebhookVerificationError{Message: "Webhook signature verification failed"}
	}

	// Parse payload
	var parsed map[string]any
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return nil, &WebhookVerificationError{Message: "Webhook payload is not valid JSON"}
	}

	// Determine event type from header or payload
	eventType := headers.Get(EventTypeHeader)
	if eventType == "" {
		if t, ok := parsed["type"].(string); ok {
			eventType = t
		} else {
			eventType = "unknown"
		}
	}

	// Get event ID from payload
	eventID := ""
	if id, ok := parsed["id"].(string); ok {
		eventID = id
	}

	return &WebhookEvent{
		ID:        eventID,
		Type:      eventType,
		Timestamp: ts,
		Payload:   parsed,
	}, nil
}

// VerifySignature verifies the signature only (without timestamp check).
func (w *Webhook) VerifySignature(payload []byte, signatureHeader string) bool {
	if !strings.HasPrefix(signatureHeader, "sha256=") {
		return false
	}

	expectedSig := strings.TrimPrefix(signatureHeader, "sha256=")
	actualSig := w.computeHMAC(payload)

	// Constant-time comparison
	expectedBytes, err := hex.DecodeString(expectedSig)
	if err != nil {
		return false
	}
	actualBytes, err := hex.DecodeString(actualSig)
	if err != nil {
		return false
	}

	return hmac.Equal(expectedBytes, actualBytes)
}

// computeHMAC computes the HMAC-SHA256 of the payload.
func (w *Webhook) computeHMAC(payload []byte) string {
	h := hmac.New(sha256.New, []byte(w.secret))
	h.Write(payload)
	return hex.EncodeToString(h.Sum(nil))
}
