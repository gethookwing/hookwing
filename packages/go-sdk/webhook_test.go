package hookwing

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"testing"
	"time"
)

func computeHMAC(secret, payload string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(payload))
	return hex.EncodeToString(h.Sum(nil))
}

func TestWebhook_NewWebhook(t *testing.T) {
	tests := []struct {
		name     string
		secret   string
		expected string
	}{
		{"with whsec_ prefix", "whsec_testsecret", "testsecret"},
		{"without whsec_ prefix", "testsecret", "testsecret"},
		{"empty prefix", "whsec_", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := NewWebhook(tt.secret)
			if w.secret != tt.expected {
				t.Errorf("expected secret %q, got %q", tt.expected, w.secret)
			}
		})
	}
}

func TestWebhook_VerifySignature(t *testing.T) {
	secret := "testsecret"
	payload := `{"event":"test","data":{"id":"123"}}`
	signature := computeHMAC(secret, payload)

	w := NewWebhook(secret)

	tests := []struct {
		name           string
		payload        []byte
		signature      string
		expectedValid  bool
	}{
		{"valid signature", []byte(payload), "sha256=" + signature, true},
		{"invalid signature", []byte(payload), "sha256=invalid", false},
		{"wrong payload", []byte("wrong payload"), "sha256=" + signature, false},
		{"missing sha256 prefix", []byte(payload), signature, false},
		{"empty signature", []byte(payload), "", false},
		{"invalid hex", []byte(payload), "sha256=nothex!!!", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			valid := w.VerifySignature(tt.payload, tt.signature)
			if valid != tt.expectedValid {
				t.Errorf("expected valid=%v, got %v", tt.expectedValid, valid)
			}
		})
	}
}

func TestWebhook_Verify(t *testing.T) {
	secret := "testsecret"
	payload := []byte(`{"id":"evt_123","type":"order.created","data":{"order_id":"ord_456"}}`)
	timestamp := time.Now().UnixMilli()
	signature := computeHMAC(secret, string(payload))

	w := NewWebhook(secret)

	t.Run("valid verification", func(t *testing.T) {
		headers := http.Header{
			"X-Hookwing-Signature": {"sha256=" + signature},
			"X-Hookwing-Timestamp": {string(rune(timestamp))},
		}
		headers.Set("X-Hookwing-Timestamp", string(rune(timestamp)))

		headers = http.Header{}
		headers.Set("X-Hookwing-Signature", "sha256="+signature)
		headers.Set("X-Hookwing-Timestamp", string(rune(timestamp)))

		// Need to use proper int64 to string conversion
		headers["X-Hookwing-Timestamp"] = []string{fmt.Sprintf("%d", timestamp)}

		event, err := w.Verify(payload, headers)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if event.ID != "evt_123" {
			t.Errorf("expected id evt_123, got %s", event.ID)
		}
		if event.Type != "order.created" {
			t.Errorf("expected type order.created, got %s", event.Type)
		}
	})

	t.Run("missing signature header", func(t *testing.T) {
		headers := http.Header{}
		headers.Set("X-Hookwing-Timestamp", fmt.Sprintf("%d", timestamp))

		_, err := w.Verify(payload, headers)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if err.Error() != "Missing X-Hookwing-Signature header" {
			t.Errorf("unexpected error message: %v", err)
		}
	})

	t.Run("missing timestamp header", func(t *testing.T) {
		headers := http.Header{}
		headers.Set("X-Hookwing-Signature", "sha256="+signature)

		_, err := w.Verify(payload, headers)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if err.Error() != "Missing X-Hookwing-Timestamp header" {
			t.Errorf("unexpected error message: %v", err)
		}
	})

	t.Run("invalid timestamp format", func(t *testing.T) {
		headers := http.Header{}
		headers.Set("X-Hookwing-Signature", "sha256="+signature)
		headers.Set("X-Hookwing-Timestamp", "not-a-number")

		_, err := w.Verify(payload, headers)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if err.Error() != "Invalid X-Hookwing-Timestamp header" {
			t.Errorf("unexpected error message: %v", err)
		}
	})

	t.Run("stale timestamp", func(t *testing.T) {
		oldTimestamp := time.Now().Add(-10 * time.Minute).UnixMilli()
		headers := http.Header{}
		headers.Set("X-Hookwing-Signature", "sha256="+signature)
		headers.Set("X-Hookwing-Timestamp", fmt.Sprintf("%d", oldTimestamp))

		_, err := w.Verify(payload, headers)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if err.Error()[:27] != "Webhook timestamp too old" {
			t.Errorf("unexpected error message: %v", err)
		}
	})

	t.Run("invalid signature", func(t *testing.T) {
		headers := http.Header{}
		headers.Set("X-Hookwing-Signature", "sha256=invalidsignature")
		headers.Set("X-Hookwing-Timestamp", fmt.Sprintf("%d", timestamp))

		_, err := w.Verify(payload, headers)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if err.Error() != "Webhook signature verification failed" {
			t.Errorf("unexpected error message: %v", err)
		}
	})

	t.Run("invalid JSON payload", func(t *testing.T) {
		invalidPayload := []byte("not valid json")
		headers := http.Header{}
		headers.Set("X-Hookwing-Signature", "sha256="+computeHMAC(secret, string(invalidPayload)))
		headers.Set("X-Hookwing-Timestamp", fmt.Sprintf("%d", timestamp))

		_, err := w.Verify(invalidPayload, headers)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if err.Error() != "Webhook payload is not valid JSON" {
			t.Errorf("unexpected error message: %v", err)
		}
	})
}

func TestWebhook_WithToleranceMs(t *testing.T) {
	secret := "testsecret"
	payload := []byte(`{"id":"evt_123","type":"test"}`)
	timestamp := time.Now().Add(-6 * time.Minute).UnixMilli() // 6 minutes ago
	signature := computeHMAC(secret, string(payload))

	// Default tolerance is 5 minutes, so this should fail
	w1 := NewWebhook(secret)
	headers := http.Header{}
	headers.Set("X-Hookwing-Signature", "sha256="+signature)
	headers.Set("X-Hookwing-Timestamp", fmt.Sprintf("%d", timestamp))

	_, err := w1.Verify(payload, headers)
	if err == nil {
		t.Error("expected error for stale timestamp with default tolerance")
	}

	// With 10 minute tolerance, it should succeed
	w2 := NewWebhook(secret, WithToleranceMs(10*60*1000))
	_, err = w2.Verify(payload, headers)
	if err != nil {
		t.Errorf("unexpected error with extended tolerance: %v", err)
	}
}

func TestWebhook_EventTypeFromHeader(t *testing.T) {
	secret := "testsecret"
	payload := []byte(`{"id":"evt_123"}`) // No type in payload
	timestamp := time.Now().UnixMilli()
	signature := computeHMAC(secret, string(payload))

	w := NewWebhook(secret)

	headers := http.Header{}
	headers.Set("X-Hookwing-Signature", "sha256="+signature)
	headers.Set("X-Hookwing-Timestamp", fmt.Sprintf("%d", timestamp))
	headers.Set("X-Event-Type", "custom.event")

	event, err := w.Verify(payload, headers)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if event.Type != "custom.event" {
		t.Errorf("expected type custom.event, got %s", event.Type)
	}
}

func TestWebhook_EventTypeFallback(t *testing.T) {
	secret := "testsecret"
	payload := []byte(`{"id":"evt_123","type":"payload.event"}`)
	timestamp := time.Now().UnixMilli()
	signature := computeHMAC(secret, string(payload))

	w := NewWebhook(secret)

	headers := http.Header{}
	headers.Set("X-Hookwing-Signature", "sha256="+signature)
	headers.Set("X-Hookwing-Timestamp", fmt.Sprintf("%d", timestamp))
	// No X-Event-Type header

	event, err := w.Verify(payload, headers)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if event.Type != "payload.event" {
		t.Errorf("expected type payload.event, got %s", event.Type)
	}
}

func TestWebhook_DefaultTolerance(t *testing.T) {
	if DefaultToleranceMs != 5*60*1000 {
		t.Errorf("expected default tolerance 300000, got %d", DefaultToleranceMs)
	}
}
