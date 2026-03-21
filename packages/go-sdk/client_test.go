package hookwing

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestClient_NewClient(t *testing.T) {
	client := NewClient("test-api-key")
	if client.apiKey != "test-api-key" {
		t.Errorf("expected apiKey test-api-key, got %s", client.apiKey)
	}
	if client.baseURL != DefaultBaseURL {
		t.Errorf("expected baseURL %s, got %s", DefaultBaseURL, client.baseURL)
	}
}

func TestClient_WithBaseURL(t *testing.T) {
	client := NewClient("test-api-key", WithBaseURL("https://custom.example.com"))
	if client.baseURL != "https://custom.example.com" {
		t.Errorf("expected baseURL https://custom.example.com, got %s", client.baseURL)
	}
}

func TestClient_ListEndpoints(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify auth header
		auth := r.Header.Get("Authorization")
		if auth != "Bearer test-api-key" {
			t.Errorf("expected Authorization header 'Bearer test-api-key', got %s", auth)
		}
		if r.Method != http.MethodGet {
			t.Errorf("expected GET method, got %s", r.Method)
		}
		if r.URL.Path != "/v1/endpoints" {
			t.Errorf("expected path /v1/endpoints, got %s", r.URL.Path)
		}

		resp := EndpointsResponse{
			Endpoints: []Endpoint{
				{ID: "ep_123", Name: "Test Endpoint", URL: "https://example.com/webhook"},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient("test-api-key", WithBaseURL(server.URL))
	endpoints, err := client.ListEndpoints(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(endpoints) != 1 {
		t.Errorf("expected 1 endpoint, got %d", len(endpoints))
	}
	if endpoints[0].ID != "ep_123" {
		t.Errorf("expected endpoint ID ep_123, got %s", endpoints[0].ID)
	}
}

func TestClient_CreateEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST method, got %s", r.Method)
		}
		if r.URL.Path != "/v1/endpoints" {
			t.Errorf("expected path /v1/endpoints, got %s", r.URL.Path)
		}

		var req CreateEndpointRequest
		json.NewDecoder(r.Body).Decode(&req)
		if req.Name != "My Endpoint" {
			t.Errorf("expected name 'My Endpoint', got %s", req.Name)
		}
		if req.URL != "https://example.com/webhook" {
			t.Errorf("expected URL https://example.com/webhook, got %s", req.URL)
		}

		resp := EndpointResponse{
			Endpoint: Endpoint{
				ID:   "ep_new",
				Name: req.Name,
				URL:  req.URL,
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient("test-api-key", WithBaseURL(server.URL))
	endpoint, err := client.CreateEndpoint(context.Background(), CreateEndpointRequest{
		Name: "My Endpoint",
		URL:  "https://example.com/webhook",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if endpoint.ID != "ep_new" {
		t.Errorf("expected endpoint ID ep_new, got %s", endpoint.ID)
	}
}

func TestClient_GetEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET method, got %s", r.Method)
		}
		if r.URL.Path != "/v1/endpoints/ep_123" {
			t.Errorf("expected path /v1/endpoints/ep_123, got %s", r.URL.Path)
		}

		resp := EndpointResponse{
			Endpoint: Endpoint{ID: "ep_123", Name: "Test"},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient("test-api-key", WithBaseURL(server.URL))
	endpoint, err := client.GetEndpoint(context.Background(), "ep_123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if endpoint.ID != "ep_123" {
		t.Errorf("expected endpoint ID ep_123, got %s", endpoint.ID)
	}
}

func TestClient_ListEvents(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/events" {
			t.Errorf("expected path /v1/events, got %s", r.URL.Path)
		}

		// Check query params
		if r.URL.Query().Get("endpoint_id") != "ep_123" {
			t.Errorf("expected endpoint_id query param ep_123")
		}
		if r.URL.Query().Get("event_type") != "order.created" {
			t.Errorf("expected event_type query param order.created")
		}

		resp := EventsResponse{
			Events: []Event{
				{ID: "evt_123", EventType: "order.created", Payload: map[string]any{"order_id": "ord_456"}},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient("test-api-key", WithBaseURL(server.URL))
	events, err := client.ListEvents(context.Background(),
		WithEndpointID("ep_123"),
		WithEventType("order.created"),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(events) != 1 {
		t.Errorf("expected 1 event, got %d", len(events))
	}
	if events[0].ID != "evt_123" {
		t.Errorf("expected event ID evt_123, got %s", events[0].ID)
	}
}

func TestClient_GetEvent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET method, got %s", r.Method)
		}
		if r.URL.Path != "/v1/events/evt_123" {
			t.Errorf("expected path /v1/events/evt_123, got %s", r.URL.Path)
		}

		resp := EventResponse{
			Event: Event{ID: "evt_123", EventType: "test"},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient("test-api-key", WithBaseURL(server.URL))
	event, err := client.GetEvent(context.Background(), "evt_123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if event.ID != "evt_123" {
		t.Errorf("expected event ID evt_123, got %s", event.ID)
	}
}

func TestClient_ReplayEvent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST method, got %s", r.Method)
		}
		if r.URL.Path != "/v1/events/evt_123/replay" {
			t.Errorf("expected path /v1/events/evt_123/replay, got %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client := NewClient("test-api-key", WithBaseURL(server.URL))
	err := client.ReplayEvent(context.Background(), "evt_123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestClient_ListDeliveries(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/deliveries" {
			t.Errorf("expected path /v1/deliveries, got %s", r.URL.Path)
		}

		resp := DeliveriesResponse{
			Deliveries: []Delivery{
				{ID: "dlv_123", EventID: "evt_123", EndpointID: "ep_123", Status: "success"},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient("test-api-key", WithBaseURL(server.URL))
	deliveries, err := client.ListDeliveries(context.Background(),
		WithEventID("evt_123"),
		WithEndpointID("ep_123"),
		WithStatus("success"),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(deliveries) != 1 {
		t.Errorf("expected 1 delivery, got %d", len(deliveries))
	}
	if deliveries[0].ID != "dlv_123" {
		t.Errorf("expected delivery ID dlv_123, got %s", deliveries[0].ID)
	}
}

func TestClient_GetDelivery(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET method, got %s", r.Method)
		}
		if r.URL.Path != "/v1/deliveries/dlv_123" {
			t.Errorf("expected path /v1/deliveries/dlv_123, got %s", r.URL.Path)
		}

		resp := DeliveryResponse{
			Delivery: Delivery{ID: "dlv_123", Status: "success"},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient("test-api-key", WithBaseURL(server.URL))
	delivery, err := client.GetDelivery(context.Background(), "dlv_123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if delivery.ID != "dlv_123" {
		t.Errorf("expected delivery ID dlv_123, got %s", delivery.ID)
	}
}

func TestClient_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"unauthorized"}`))
	}))
	defer server.Close()

	client := NewClient("test-api-key", WithBaseURL(server.URL))
	_, err := client.ListEndpoints(context.Background())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestClient_ListEventsWithLimit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		limit := r.URL.Query().Get("limit")
		if limit != "25" {
			t.Errorf("expected limit 25, got %s", limit)
		}

		resp := EventsResponse{Events: []Event{}}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient("test-api-key", WithBaseURL(server.URL))
	_, err := client.ListEvents(context.Background(), WithLimit(25))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// Test helper function for fmt.Sprintf usage
func ExampleWebhook_Verify() {
	// This is just to ensure fmt is imported and used correctly
	_ = fmt.Sprintf("%d", time.Now().UnixMilli())
}
