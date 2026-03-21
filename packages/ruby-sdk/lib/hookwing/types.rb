# frozen_string_literal: true

require "time"

module Hookwing
  # A webhook endpoint
  class Endpoint
    attr_reader :id, :name, :url, :description, :events, :secret, :is_enabled, :created_at, :updated_at

    # @param data [Hash]
    def initialize(data)
      @id = data["id"]
      @name = data["name"]
      @url = data["url"]
      @description = data["description"]
      @events = data["events"]
      @secret = data["secret"]
      @is_enabled = data.fetch("is_enabled", true)
      @created_at = parse_time(data["created_at"])
      @updated_at = parse_time(data["updated_at"])
    end

    # @return [Hash]
    def to_h
      {
        "id" => id,
        "name" => name,
        "url" => url,
        "description" => description,
        "events" => events,
        "secret" => secret,
        "is_enabled" => is_enabled,
        "created_at" => created_at&.iso8601,
        "updated_at" => updated_at&.iso8601
      }
    end

    private

    def parse_time(value)
      return nil if value.nil?
      value.is_a?(Time) ? value : Time.parse(value)
    end
  end

  # A webhook event
  class Event
    attr_reader :id, :event_type, :payload, :created_at

    # @param data [Hash]
    def initialize(data)
      @id = data["id"]
      @event_type = data["event_type"]
      @payload = data["payload"]
      @created_at = parse_time(data["created_at"])
    end

    # @return [Hash]
    def to_h
      {
        "id" => id,
        "event_type" => event_type,
        "payload" => payload,
        "created_at" => created_at&.iso8601
      }
    end

    private

    def parse_time(value)
      return nil if value.nil?
      value.is_a?(Time) ? value : Time.parse(value)
    end
  end

  # A webhook delivery attempt
  class Delivery
    attr_reader :id, :event_id, :endpoint_id, :url, :status_code, :status,
                :response_body, :error_message, :attempt, :created_at, :completed_at

    # @param data [Hash]
    def initialize(data)
      @id = data["id"]
      @event_id = data["event_id"]
      @endpoint_id = data["endpoint_id"]
      @url = data["url"]
      @status_code = data["status_code"]
      @status = data.fetch("status", "pending")
      @response_body = data["response_body"]
      @error_message = data["error_message"]
      @attempt = data.fetch("attempt", 1)
      @created_at = parse_time(data["created_at"])
      @completed_at = parse_time(data["completed_at"])
    end

    # @return [Hash]
    def to_h
      {
        "id" => id,
        "event_id" => event_id,
        "endpoint_id" => endpoint_id,
        "url" => url,
        "status_code" => status_code,
        "status" => status,
        "response_body" => response_body,
        "error_message" => error_message,
        "attempt" => attempt,
        "created_at" => created_at&.iso8601,
        "completed_at" => completed_at&.iso8601
      }
    end

    private

    def parse_time(value)
      return nil if value.nil?
      value.is_a?(Time) ? value : Time.parse(value)
    end
  end
end
