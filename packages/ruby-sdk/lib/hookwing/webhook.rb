# frozen_string_literal: true

require "json"
require "time"

module Hookwing
  # Webhook verification error
  class WebhookVerificationError < StandardError
  end

  # Parsed webhook event
  WebhookEvent = Struct.new(:id, :type, :timestamp, :payload, keyword_init: true)

  # Default tolerance window for timestamp verification (5 minutes)
  DEFAULT_TOLERANCE_MS = 5 * 60 * 1000

  # Verifies Hookwing webhook signatures
  class Webhook
    # @return [String] The webhook signing secret
    attr_reader :secret

    # @param secret [String] The webhook signing secret (with or without 'whsec_' prefix)
    # @param tolerance_ms [Integer] Maximum age in milliseconds for timestamp validation (default: 5 minutes)
    def initialize(secret, tolerance_ms: DEFAULT_TOLERANCE_MS)
      raise ArgumentError, "Webhook secret is required" if secret.nil? || secret.empty?

      # Strip 'whsec_' prefix if present
      @secret = secret.start_with?("whsec_") ? secret[6..] : secret
      @tolerance_ms = tolerance_ms
    end

    # Verify a webhook payload and return the parsed event
    #
    # @param payload [String] The raw request body
    # @param signature [String] The signature header value (e.g., 'sha256=abc123...')
    # @param timestamp [String, Integer] The timestamp header value (unix milliseconds)
    # @return [WebhookEvent] The parsed and verified event
    # @raise [WebhookVerificationError] If signature is invalid, timestamp is missing/stale,
    #                                    or payload is not valid JSON
    def verify(payload, signature:, timestamp:)
      unless signature
        raise WebhookVerificationError, "Missing X-Hookwing-Signature header"
      end
      unless timestamp
        raise WebhookVerificationError, "Missing X-Hookwing-Timestamp header"
      end

      # Validate timestamp format
      ts = timestamp.is_a?(Integer) ? timestamp : Integer(timestamp)

      # Check timestamp staleness
      now = (Time.now.to_f * 1000).to_i # milliseconds
      age = (now - ts).abs
      if age > @tolerance_ms
        raise WebhookVerificationError,
              "Webhook timestamp too old (#{(age / 1000).round}s ago, " \
              "tolerance: #{(@tolerance_ms / 1000).round}s)"
      end

      # Verify HMAC signature
      unless verify_signature(payload, signature)
        raise WebhookVerificationError, "Webhook signature verification failed"
      end

      # Parse payload
      begin
        parsed = JSON.parse(payload)
      rescue JSON::ParserError
        raise WebhookVerificationError, "Webhook payload is not valid JSON"
      end

      event = parsed.is_a?(Hash) ? parsed : {}

      WebhookEvent.new(
        id: event["id"] || "",
        type: event["type"] || "unknown",
        timestamp: ts,
        payload: event
      )
    end

    # Verify signature only (without timestamp check)
    #
    # @param payload [String] The raw payload string
    # @param signature_header [String] The signature header value (e.g., 'sha256=abc123...')
    # @return [bool] True if signature is valid, False otherwise
    def verify_signature(payload, signature_header)
      return false unless signature_header
      return false unless signature_header.start_with?("sha256=")

      expected_sig = signature_header[7..] # Strip 'sha256='
      actual_sig = compute_hmac(payload)

      # Constant-time comparison (Rack::Utils.secure_compare)
      secure_compare(expected_sig, actual_sig)
    end

    private

    # Compute HMAC-SHA256 of the payload
    #
    # @param payload [String] The payload string to sign
    # @return [String] Hex-encoded signature
    def compute_hmac(payload)
      require "openssl"
      OpenSSL::HMAC.hexdigest(
        OpenSSL::Digest.new("sha256"),
        @secret,
        payload
      )
    end

    # Constant-time string comparison to prevent timing attacks
    #
    # @param a [String]
    # @param b [String]
    # @return [bool]
    def secure_compare(a, b)
      require "rack/utils"
      Rack::Utils.secure_compare(a, b)
    end
  end
end
