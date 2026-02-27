output "worker_name" {
  description = "Worker script name"
  value       = "hookwing-api-${var.environment}"
}

output "queue_id" {
  description = "Queue ID"
  value       = try(cloudflare_queue.webhook_delivery[0].id, "")
  sensitive   = true
}
