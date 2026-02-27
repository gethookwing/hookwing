variable "environment" {
  description = "Environment name"
  type        = string
}

variable "account_id" {
  description = "Cloudflare Account ID"
  type        = string
  sensitive   = true
}

variable "d1_name" {
  description = "D1 database name (managed via wrangler)"
  type        = string
  default     = ""  # Optional - managed externally
}

variable "enable_d1" {
  description = "Enable D1 (not implemented in terraform)"
  type        = bool
  default     = false
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
