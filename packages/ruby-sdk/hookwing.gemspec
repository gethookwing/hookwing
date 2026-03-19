# frozen_string_literal: true

Gem::Specification.new do |spec|
  spec.name = "hookwing"
  spec.version = Hookwing::VERSION
  spec.authors = ["Hookwing"]
  spec.email = ["support@hookwing.com"]
  spec.summary = "Hookwing SDK for Ruby - Webhook verification and API client"
  spec.description = <<-DESC
    Hookwing SDK for Ruby provides webhook signature verification
    and a typed API client for managing webhooks.
  DESC
  spec.homepage = "https://hookwing.com"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 2.7"

  spec.files = Dir.glob("lib/**/*.rb")
  spec.require_paths = ["lib"]

  # Runtime dependencies
  spec.add_runtime_dependency "rack", ">= 2.0"

  # Development dependencies
  spec.add_development_dependency "rspec", "~> 3.0"
end
