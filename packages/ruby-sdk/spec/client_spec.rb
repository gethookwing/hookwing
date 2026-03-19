# frozen_string_literal: true

require "bundler/setup"
require "hookwing"
require "webmock"

RSpec.describe Hookwing::Client do
  let(:api_key) { "test_api_key" }
  let(:client) { Hookwing::Client.new(api_key) }

  before do
    WebMock.enable!
    WebMock.disable_net_connect!
  end

  after do
    WebMock.disable!
  end

  describe "#initialize" do
    it "raises ArgumentError if api_key is nil" do
      expect { Hookwing::Client.new(nil) }.to raise_error(ArgumentError, "API key is required")
    end

    it "raises ArgumentError if api_key is empty" do
      expect { Hookwing::Client.new("") }.to raise_error(ArgumentError, "API key is required")
    end

    it "uses default base URL" do
      expect(client.instance_variable_get(:@base_url)).to eq("https://api.hookwing.com")
    end

    it "allows custom base URL" do
      custom_client = Hookwing::Client.new(api_key, base_url: "https://custom.api.example.com")
      expect(custom_client.instance_variable_get(:@base_url)).to eq("https://custom.api.example.com")
    end
  end

  describe "#list_endpoints" do
    it "returns list of endpoints" do
      stub_request(:get, "https://api.hookwing.com/v1/endpoints")
        .to_return(
          status: 200,
          body: JSON.generate({
            "endpoints" => [
              { "id" => "ep_123", "name" => "Test Endpoint", "url" => "https://example.com/webhook" }
            ]
          }),
          headers: { "Content-Type" => "application/json" }
        )

      endpoints = client.list_endpoints

      expect(endpoints).to be_an(Array)
      expect(endpoints.length).to eq(1)
      expect(endpoints.first).to be_a(Hookwing::Endpoint)
      expect(endpoints.first.id).to eq("ep_123")
      expect(endpoints.first.name).to eq("Test Endpoint")
    end
  end

  describe "#create_endpoint" do
    it "creates endpoint and returns it" do
      stub_request(:post, "https://api.hookwing.com/v1/endpoints")
        .to_return(
          status: 201,
          body: JSON.generate({
            "endpoint" => {
              "id" => "ep_456",
              "name" => "New Endpoint",
              "url" => "https://example.com/new"
            }
          }),
          headers: { "Content-Type" => "application/json" }
        )

      endpoint = client.create_endpoint("New Endpoint", "https://example.com/new")

      expect(endpoint).to be_a(Hookwing::Endpoint)
      expect(endpoint.id).to eq("ep_456")
      expect(endpoint.name).to eq("New Endpoint")
    end

    it "includes optional description and events" do
      stub_request(:post, "https://api.hookwing.com/v1/endpoints")
        .with(body: /description/)
        .to_return(
          status: 201,
          body: JSON.generate({
            "endpoint" => {
              "id" => "ep_456",
              "name" => "New Endpoint",
              "url" => "https://example.com/new",
              "description" => "My description",
              "events" => ["order.created"]
            }
          })
        )

      endpoint = client.create_endpoint(
        "New Endpoint",
        "https://example.com/new",
        description: "My description",
        events: ["order.created"]
      )

      expect(endpoint.description).to eq("My description")
      expect(endpoint.events).to eq(["order.created"])
    end
  end

  describe "#get_endpoint" do
    it "returns endpoint by ID" do
      stub_request(:get, "https://api.hookwing.com/v1/endpoints/ep_123")
        .to_return(
          status: 200,
          body: JSON.generate({
            "endpoint" => {
              "id" => "ep_123",
              "name" => "Test Endpoint",
              "url" => "https://example.com/webhook"
            }
          }),
          headers: { "Content-Type" => "application/json" }
        )

      endpoint = client.get_endpoint("ep_123")

      expect(endpoint).to be_a(Hookwing::Endpoint)
      expect(endpoint.id).to eq("ep_123")
    end
  end

  describe "#delete_endpoint" do
    it "deletes endpoint" do
      stub_request(:delete, "https://api.hookwing.com/v1/endpoints/ep_123")
        .to_return(status: 204)

      expect { client.delete_endpoint("ep_123") }.not_to raise_error
    end
  end

  describe "#list_events" do
    it "returns list of events" do
      stub_request(:get, "https://api.hookwing.com/v1/events")
        .to_return(
          status: 200,
          body: JSON.generate({
            "events" => [
              { "id" => "evt_123", "event_type" => "order.created", "payload" => {} }
            ]
          }),
          headers: { "Content-Type" => "application/json" }
        )

      events = client.list_events

      expect(events).to be_an(Array)
      expect(events.length).to eq(1)
      expect(events.first).to be_a(Hookwing::Event)
    end
  end

  describe "#get_event" do
    it "returns event by ID" do
      stub_request(:get, "https://api.hookwing.com/v1/events/evt_123")
        .to_return(
          status: 200,
          body: JSON.generate({
            "event" => {
              "id" => "evt_123",
              "event_type" => "order.created",
              "payload" => {}
            }
          }),
          headers: { "Content-Type" => "application/json" }
        )

      event = client.get_event("evt_123")

      expect(event).to be_a(Hookwing::Event)
      expect(event.id).to eq("evt_123")
    end
  end

  describe "#replay_event" do
    it "replays event" do
      stub_request(:post, "https://api.hookwing.com/v1/events/evt_123/replay")
        .to_return(status: 204)

      expect { client.replay_event("evt_123") }.not_to raise_error
    end
  end

  describe "#list_deliveries" do
    it "returns list of deliveries" do
      stub_request(:get, "https://api.hookwing.com/v1/deliveries")
        .to_return(
          status: 200,
          body: JSON.generate({
            "deliveries" => [
              { "id" => "dlv_123", "event_id" => "evt_123", "endpoint_id" => "ep_123", "url" => "https://example.com", "status" => "success" }
            ]
          }),
          headers: { "Content-Type" => "application/json" }
        )

      deliveries = client.list_deliveries

      expect(deliveries).to be_an(Array)
      expect(deliveries.length).to eq(1)
      expect(deliveries.first).to be_a(Hookwing::Delivery)
    end
  end

  describe "#get_delivery" do
    it "returns delivery by ID" do
      stub_request(:get, "https://api.hookwing.com/v1/deliveries/dlv_123")
        .to_return(
          status: 200,
          body: JSON.generate({
            "delivery" => {
              "id" => "dlv_123",
              "event_id" => "evt_123",
              "endpoint_id" => "ep_123",
              "url" => "https://example.com",
              "status" => "success"
            }
          }),
          headers: { "Content-Type" => "application/json" }
        )

      delivery = client.get_delivery("dlv_123")

      expect(delivery).to be_a(Hookwing::Delivery)
      expect(delivery.id).to eq("dlv_123")
    end
  end

  describe "error handling" do
    it "raises ClientError for non-2xx responses" do
      stub_request(:get, "https://api.hookwing.com/v1/endpoints")
        .to_return(status: 401, body: JSON.generate({ "error" => "Unauthorized" }))

      expect { client.list_endpoints }.to raise_error(Hookwing::ClientError, /401/)
    end
  end

  describe "#close" do
    it "is a no-op" do
      expect { client.close }.not_to raise_error
    end
  end
end
