# frozen_string_literal: true

require "bundler/setup"
require "hookwing"

RSpec.describe Hookwing::Webhook do
  let(:secret) { "test_signing_secret" }

  describe "#initialize" do
    it "raises ArgumentError if secret is nil" do
      expect { Hookwing::Webhook.new(nil) }.to raise_error(ArgumentError, "Webhook secret is required")
    end

    it "raises ArgumentError if secret is empty" do
      expect { Hookwing::Webhook.new("") }.to raise_error(ArgumentError, "Webhook secret is required")
    end

    it "strips 'whsec_' prefix if present" do
      webhook = Hookwing::Webhook.new("whsec_test_secret")
      expect(webhook.secret).to eq("test_secret")
    end

    it "accepts secret without prefix" do
      webhook = Hookwing::Webhook.new("test_secret")
      expect(webhook.secret).to eq("test_secret")
    end
  end

  describe "#verify_signature" do
    let(:webhook) { Hookwing::Webhook.new(secret) }
    let(:payload) { '{"id":"evt_123","type":"order.created"}' }

    it "returns true for valid signature" do
      # Compute expected signature
      expected_sig = OpenSSL::HMAC.hexdigest(
        OpenSSL::Digest.new("sha256"),
        secret,
        payload
      )
      signature = "sha256=#{expected_sig}"

      expect(webhook.verify_signature(payload, signature)).to be true
    end

    it "returns false for invalid signature" do
      expect(webhook.verify_signature(payload, "sha256=invalid")).to be false
    end

    it "returns false if signature doesn't start with sha256=" do
      expect(webhook.verify_signature(payload, "abc123")).to be false
    end

    it "returns false if signature is nil" do
      expect(webhook.verify_signature(payload, nil)).to be false
    end
  end

  describe "#verify" do
    let(:webhook) { Hookwing::Webhook.new(secret, tolerance_ms: 300_000) }
    let(:payload) { '{"id":"evt_123","type":"order.created","data":{"order_id":"ord_456"}}' }

    it "verifies valid payload and returns WebhookEvent" do
      now = (Time.now.to_f * 1000).to_i
      expected_sig = OpenSSL::HMAC.hexdigest(
        OpenSSL::Digest.new("sha256"),
        secret,
        payload
      )
      signature = "sha256=#{expected_sig}"

      event = webhook.verify(payload, signature: signature, timestamp: now)

      expect(event.id).to eq("evt_123")
      expect(event.type).to eq("order.created")
      expect(event.timestamp).to eq(now)
      expect(event.payload).to be_a(Hash)
    end

    it "raises error for missing signature" do
      expect {
        webhook.verify(payload, signature: nil, timestamp: Time.now.to_i)
      }.to raise_error(Hookwing::WebhookVerificationError, "Missing X-Hookwing-Signature header")
    end

    it "raises error for missing timestamp" do
      expect {
        webhook.verify(payload, signature: "sha256=abc", timestamp: nil)
      }.to raise_error(Hookwing::WebhookVerificationError, "Missing X-Hookwing-Timestamp header")
    end

    it "raises error for stale timestamp" do
      stale_timestamp = ((Time.now.to_f * 1000) - 400_000).to_i # 6+ minutes ago
      expect {
        webhook.verify(payload, signature: "sha256=abc", timestamp: stale_timestamp)
      }.to raise_error(Hookwing::WebhookVerificationError, /too old/)
    end

    it "raises error for invalid JSON" do
      now = (Time.now.to_f * 1000).to_i
      invalid_payload = "not valid json"
      expected_sig = OpenSSL::HMAC.hexdigest(
        OpenSSL::Digest.new("sha256"),
        secret,
        invalid_payload
      )
      signature = "sha256=#{expected_sig}"

      expect {
        webhook.verify(invalid_payload, signature: signature, timestamp: now)
      }.to raise_error(Hookwing::WebhookVerificationError, "Webhook payload is not valid JSON")
    end

    it "raises error for invalid signature" do
      now = (Time.now.to_f * 1000).to_i
      expect {
        webhook.verify(payload, signature: "sha256=invalid", timestamp: now)
      }.to raise_error(Hookwing::WebhookVerificationError, "Webhook signature verification failed")
    end
  end
end
