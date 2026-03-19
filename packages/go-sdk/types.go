package hookwing

import "time"

// Endpoint represents a webhook endpoint.
type Endpoint struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	URL         string     `json:"url"`
	Description *string    `json:"description,omitempty"`
	Events      []string   `json:"events,omitempty"`
	Secret      *string    `json:"secret,omitempty"`
	IsEnabled   bool       `json:"is_enabled"`
	CreatedAt   *time.Time `json:"created_at,omitempty"`
	UpdatedAt   *time.Time `json:"updated_at,omitempty"`
}

// Event represents a webhook event.
type Event struct {
	ID        string         `json:"id"`
	EventType string         `json:"event_type"`
	Payload   map[string]any `json:"payload"`
	CreatedAt *time.Time     `json:"created_at,omitempty"`
}

// Delivery represents a webhook delivery attempt.
type Delivery struct {
	ID            string     `json:"id"`
	EventID       string     `json:"event_id"`
	EndpointID    string     `json:"endpoint_id"`
	URL           string     `json:"url"`
	StatusCode    *int       `json:"status_code,omitempty"`
	Status        string     `json:"status"`
	ResponseBody  *string    `json:"response_body,omitempty"`
	ErrorMessage  *string    `json:"error_message,omitempty"`
	Attempt       int        `json:"attempt"`
	CreatedAt     *time.Time `json:"created_at,omitempty"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`
}

// WebhookEvent represents a parsed webhook event from verification.
type WebhookEvent struct {
	ID        string         `json:"id"`
	Type      string         `json:"type"`
	Timestamp int64          `json:"timestamp"`
	Payload   map[string]any `json:"payload"`
}

// CreateEndpointRequest represents the request to create an endpoint.
type CreateEndpointRequest struct {
	Name        string   `json:"name"`
	URL         string   `json:"url"`
	Description string   `json:"description,omitempty"`
	Events      []string `json:"events,omitempty"`
}

// ListOptions represents options for listing resources.
type ListOptions struct {
	EndpointID string `json:"endpoint_id,omitempty"`
	EventID     string `json:"event_id,omitempty"`
	EventType   string `json:"event_type,omitempty"`
	Status      string `json:"status,omitempty"`
	Limit       int    `json:"limit,omitempty"`
}

// EndpointsResponse represents the API response for listing endpoints.
type EndpointsResponse struct {
	Endpoints []Endpoint `json:"endpoints"`
}

// EndpointResponse represents the API response for a single endpoint.
type EndpointResponse struct {
	Endpoint Endpoint `json:"endpoint"`
}

// EventsResponse represents the API response for listing events.
type EventsResponse struct {
	Events []Event `json:"events"`
}

// EventResponse represents the API response for a single event.
type EventResponse struct {
	Event Event `json:"event"`
}

// DeliveriesResponse represents the API response for listing deliveries.
type DeliveriesResponse struct {
	Deliveries []Delivery `json:"deliveries"`
}

// DeliveryResponse represents the API response for a single delivery.
type DeliveryResponse struct {
	Delivery Delivery `json:"delivery"`
}
