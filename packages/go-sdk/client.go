package hookwing

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	// DefaultBaseURL is the default base URL for the Hookwing API.
	DefaultBaseURL = "https://api.hookwing.com"
)

// ClientOption is a functional option for configuring a Client.
type ClientOption func(*Client)

// WithBaseURL sets the base URL for the API.
func WithBaseURL(baseURL string) ClientOption {
	return func(c *Client) {
		c.baseURL = strings.TrimSuffix(baseURL, "/")
	}
}

// WithHTTPClient sets a custom HTTP client.
func WithHTTPClient(httpClient *http.Client) ClientOption {
	return func(c *Client) {
		c.http = httpClient
	}
}

// WithTimeout sets the request timeout.
func WithTimeout(timeout time.Duration) ClientOption {
	return func(c *Client) {
		c.timeout = timeout
	}
}

// Client is a typed API client for Hookwing.
type Client struct {
	apiKey   string
	baseURL  string
	http     *http.Client
	timeout  time.Duration
}

// NewClient creates a new Hookwing API client.
func NewClient(apiKey string, opts ...ClientOption) *Client {
	c := &Client{
		apiKey:   apiKey,
		baseURL:  DefaultBaseURL,
		http:     &http.Client{},
		timeout:  30 * time.Second,
	}

	for _, opt := range opts {
		opt(c)
	}

	return c
}

// ListOption is a functional option for list methods.
type ListOption func(*ListOptions)

// WithEndpointID filters by endpoint ID.
func WithEndpointID(endpointID string) ListOption {
	return func(o *ListOptions) {
		o.EndpointID = endpointID
	}
}

// WithEventID filters by event ID.
func WithEventID(eventID string) ListOption {
	return func(o *ListOptions) {
		o.EventID = eventID
	}
}

// WithEventType filters by event type.
func WithEventType(eventType string) ListOption {
	return func(o *ListOptions) {
		o.EventType = eventType
	}
}

// WithStatus filters by status.
func WithStatus(status string) ListOption {
	return func(o *ListOptions) {
		o.Status = status
	}
}

// WithLimit sets the limit.
func WithLimit(limit int) ListOption {
	return func(o *ListOptions) {
		o.Limit = limit
	}
}

func (c *Client) request(ctx context.Context, method, path string, body any) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	if bodyReader != nil {
		req.Header.Set("Content-Length", "0") // Will be set automatically
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	return resp, nil
}

func (c *Client) doRequest(ctx context.Context, method, path string, body any, response any) error {
	resp, err := c.request(ctx, method, path, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	if response == nil {
		return nil
	}

	return json.NewDecoder(resp.Body).Decode(response)
}

// ListEndpoints lists all endpoints.
func (c *Client) ListEndpoints(ctx context.Context) ([]Endpoint, error) {
	var resp EndpointsResponse
	err := c.doRequest(ctx, http.MethodGet, "/v1/endpoints", nil, &resp)
	return resp.Endpoints, err
}

// CreateEndpoint creates a new endpoint.
func (c *Client) CreateEndpoint(ctx context.Context, req CreateEndpointRequest) (*Endpoint, error) {
	var resp EndpointResponse
	err := c.doRequest(ctx, http.MethodPost, "/v1/endpoints", req, &resp)
	return &resp.Endpoint, err
}

// GetEndpoint gets an endpoint by ID.
func (c *Client) GetEndpoint(ctx context.Context, id string) (*Endpoint, error) {
	var resp EndpointResponse
	err := c.doRequest(ctx, http.MethodGet, fmt.Sprintf("/v1/endpoints/%s", id), nil, &resp)
	return &resp.Endpoint, err
}

// ListEvents lists events.
func (c *Client) ListEvents(ctx context.Context, opts ...ListOption) ([]Event, error) {
	options := &ListOptions{Limit: 50}
	for _, opt := range opts {
		opt(options)
	}

	query := url.Values{}
	if options.EndpointID != "" {
		query.Set("endpoint_id", options.EndpointID)
	}
	if options.EventType != "" {
		query.Set("event_type", options.EventType)
	}
	if options.Limit > 0 {
		query.Set("limit", fmt.Sprintf("%d", options.Limit))
	}

	path := "/v1/events"
	if len(query) > 0 {
		path += "?" + query.Encode()
	}

	var resp EventsResponse
	err := c.doRequest(ctx, http.MethodGet, path, nil, &resp)
	return resp.Events, err
}

// GetEvent gets an event by ID.
func (c *Client) GetEvent(ctx context.Context, id string) (*Event, error) {
	var resp EventResponse
	err := c.doRequest(ctx, http.MethodGet, fmt.Sprintf("/v1/events/%s", id), nil, &resp)
	return &resp.Event, err
}

// ReplayEvent replays an event.
func (c *Client) ReplayEvent(ctx context.Context, id string) error {
	return c.doRequest(ctx, http.MethodPost, fmt.Sprintf("/v1/events/%s/replay", id), nil, nil)
}

// ListDeliveries lists deliveries.
func (c *Client) ListDeliveries(ctx context.Context, opts ...ListOption) ([]Delivery, error) {
	options := &ListOptions{Limit: 50}
	for _, opt := range opts {
		opt(options)
	}

	query := url.Values{}
	if options.EventID != "" {
		query.Set("event_id", options.EventID)
	}
	if options.EndpointID != "" {
		query.Set("endpoint_id", options.EndpointID)
	}
	if options.Status != "" {
		query.Set("status", options.Status)
	}
	if options.Limit > 0 {
		query.Set("limit", fmt.Sprintf("%d", options.Limit))
	}

	path := "/v1/deliveries"
	if len(query) > 0 {
		path += "?" + query.Encode()
	}

	var resp DeliveriesResponse
	err := c.doRequest(ctx, http.MethodGet, path, nil, &resp)
	return resp.Deliveries, err
}

// GetDelivery gets a delivery by ID.
func (c *Client) GetDelivery(ctx context.Context, id string) (*Delivery, error) {
	var resp DeliveryResponse
	err := c.doRequest(ctx, http.MethodGet, fmt.Sprintf("/v1/deliveries/%s", id), nil, &resp)
	return &resp.Delivery, err
}
