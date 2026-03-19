# frozen_string_literal: true

require "net/http"
require "uri"
require "json"

module Hookwing
  # API client error
  class ClientError < StandardError
    attr_reader :status_code

    def initialize(message, status_code: nil)
      super(message)
      @status_code = status_code
    end
  end

  # HTTP client for Hookwing API
  class Client
    DEFAULT_BASE_URL = "https://api.hookwing.com"
    DEFAULT_TIMEOUT = 30

    # @param api_key [String] Your Hookwing API key
    # @param base_url [String] Base URL for the API (default: https://api.hookwing.com)
    # @param timeout [Integer] Request timeout in seconds (default: 30)
    def initialize(api_key, base_url: DEFAULT_BASE_URL, timeout: DEFAULT_TIMEOUT)
      raise ArgumentError, "API key is required" if api_key.nil? || api_key.empty?

      @api_key = api_key
      @base_url = base_url.chomp("/")
      @timeout = timeout
    end

    # Close the client (no-op for net/http)
    def close
      # No-op: net/http doesn't require explicit closing
    end

    # === Endpoints ===

    # List all endpoints
    # @return [Array<Endpoint>]
    def list_endpoints
      data = request(:get, "/v1/endpoints")
      data.dig("endpoints")&.map { |item| Endpoint.new(item) } || []
    end

    # Create a new endpoint
    # @param name [String] Name of the endpoint
    # @param url [String] Destination URL for webhooks
    # @param description [String, nil] Optional description
    # @param events [Array<String>, nil] List of event types to subscribe to
    # @return [Endpoint]
    def create_endpoint(name, url, description: nil, events: nil)
      payload = { "name" => name, "url" => url }
      payload["description"] = description if description
      payload["events"] = events if events

      data = request(:post, "/v1/endpoints", body: payload)
      Endpoint.new(data["endpoint"])
    end

    # Get an endpoint by ID
    # @param id [String] Endpoint ID
    # @return [Endpoint]
    def get_endpoint(id)
      data = request(:get, "/v1/endpoints/#{id}")
      Endpoint.new(data["endpoint"])
    end

    # Update an endpoint
    # @param id [String] Endpoint ID
    # @param name [String, nil] New name
    # @param url [String, nil] New URL
    # @param description [String, nil] New description
    # @param events [Array<String>, nil] New event list
    # @param is_enabled [bool, nil] Enable/disable endpoint
    # @return [Endpoint]
    def update_endpoint(id, name: nil, url: nil, description: nil, events: nil, is_enabled: nil)
      payload = {}
      payload["name"] = name if name
      payload["url"] = url if url
      payload["description"] = description if description
      payload["events"] = events if events
      payload["is_enabled"] = is_enabled if is_enabled

      data = request(:patch, "/v1/endpoints/#{id}", body: payload)
      Endpoint.new(data["endpoint"])
    end

    # Delete an endpoint
    # @param id [String] Endpoint ID
    # @return [void]
    def delete_endpoint(id)
      request(:delete, "/v1/endpoints/#{id}")
      nil
    end

    # === Events ===

    # List events
    # @param endpoint_id [String, nil] Filter by endpoint ID
    # @param event_type [String, nil] Filter by event type
    # @param limit [Integer] Maximum number of events to return
    # @return [Array<Event>]
    def list_events(endpoint_id: nil, event_type: nil, limit: 50)
      params = { "limit" => limit }
      params["endpoint_id"] = endpoint_id if endpoint_id
      params["event_type"] = event_type if event_type

      data = request(:get, "/v1/events", params: params)
      data.dig("events")&.map { |item| Event.new(item) } || []
    end

    # Get an event by ID
    # @param id [String] Event ID
    # @return [Event]
    def get_event(id)
      data = request(:get, "/v1/events/#{id}")
      Event.new(data["event"])
    end

    # Replay/retry an event
    # @param id [String] Event ID
    # @return [void]
    def replay_event(id)
      request(:post, "/v1/events/#{id}/replay")
      nil
    end

    # === Deliveries ===

    # List deliveries
    # @param event_id [String, nil] Filter by event ID
    # @param endpoint_id [String, nil] Filter by endpoint ID
    # @param status [String, nil] Filter by status (pending, success, failed)
    # @param limit [Integer] Maximum number of deliveries to return
    # @return [Array<Delivery>]
    def list_deliveries(event_id: nil, endpoint_id: nil, status: nil, limit: 50)
      params = { "limit" => limit }
      params["event_id"] = event_id if event_id
      params["endpoint_id"] = endpoint_id if endpoint_id
      params["status"] = status if status

      data = request(:get, "/v1/deliveries", params: params)
      data.dig("deliveries")&.map { |item| Delivery.new(item) } || []
    end

    # Get a delivery by ID
    # @param id [String] Delivery ID
    # @return [Delivery]
    def get_delivery(id)
      data = request(:get, "/v1/deliveries/#{id}")
      Delivery.new(data["delivery"])
    end

    private

    # Make an HTTP request to the API
    # @param method [Symbol] HTTP method
    # @param path [String] Request path
    # @param params [Hash, nil] Query parameters
    # @param body [Hash, nil] Request body
    # @return [Hash] Response data
    def request(method, path, params: nil, body: nil)
      uri = URI.parse("#{@base_url}#{path}")

      # Add query parameters
      if params && !params.empty?
        uri.query = URI.encode_www_form(params)
      end

      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == "https")
      http.open_timeout = @timeout
      http.read_timeout = @timeout

      request = case method
                 when :get then Net::HTTP::Get.new(uri)
                 when :post then Net::HTTP::Post.new(uri)
                 when :patch then Net::HTTP::Patch.new(uri)
                 when :delete then Net::HTTP::Delete.new(uri)
                 else raise ArgumentError, "Unsupported HTTP method: #{method}"
                 end

      request["Authorization"] = "Bearer #{@api_key}"
      request["Content-Type"] = "application/json"
      request["Accept"] = "application/json"

      if body
        request.body = JSON.generate(body)
      end

      response = http.request(request)

      unless response.code.to_i >= 200 && response.code.to_i < 300
        raise ClientError.new(
          "API request failed: #{response.code} #{response.message}",
          status_code: response.code.to_i
        )
      end

      # Handle empty responses (e.g., 204 No Content)
      return {} if response.body.nil? || response.body.empty?

      JSON.parse(response.body)
    end
  end
end
