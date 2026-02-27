# Hookwing Module - Core Infrastructure

# Queue for webhook delivery
resource "cloudflare_queue" "webhook_delivery" {
  count = var.enable_queues ? 1 : 0
  
  account_id = var.account_id
  name       = "hookwing-webhook-delivery-${var.environment}"
}

# Note: 
# - D1 is managed via wrangler 
# - KV requires additional permissions
