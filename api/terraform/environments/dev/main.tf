# Dev Environment

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "account_id" {
  description = "Cloudflare Account ID"
  type        = string
  sensitive   = true
}

variable "enable_workers" {
  description = "Enable Workers"
  type        = bool
  default     = true
}

variable "enable_queues" {
  description = "Enable Queues"
  type        = bool
  default     = true
}

module "hookwing_dev" {
  source = "../../modules/hookwing"
  
  environment    = var.environment
  account_id     = var.account_id
  enable_workers = var.enable_workers
  enable_queues  = var.enable_queues
}

output "environment" {
  value = var.environment
}

output "queue_id" {
  value = module.hookwing_dev.queue_id
  sensitive = true
}
