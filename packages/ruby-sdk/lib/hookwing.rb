# frozen_string_literal: true

# Hookwing - Webhook management SDK for Ruby
#
# @example
#   require 'hookwing'
#
#   # Verify webhook signatures
#   wh = Hookwing::Webhook.new('whsec_your_signing_secret')
#   event = wh.verify(payload, signature: 'sha256=...', timestamp: '1234567890')
#
#   # Use the API client
#   client = Hookwing::Client.new('your-api-key')
#   endpoints = client.list_endpoints

module Hookwing
  # Current SDK version
  VERSION = "0.1.0"
end

# Load submodules
require_relative "hookwing/version"
require_relative "hookwing/types"
require_relative "hookwing/webhook"
require_relative "hookwing/client"
