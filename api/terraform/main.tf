# Hookwing - Main Terraform Configuration

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  # Token is read from CLOUDFLARE_API_TOKEN env var
}

# Local values
locals {
  tags = {
    ManagedBy = "terraform"
    Project   = "hookwing"
  }
}
