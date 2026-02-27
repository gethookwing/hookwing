# Variables for all environments

variable "environment" {
  description = "Environment: dev, staging, or prod"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "account_id" {
  description = "Cloudflare Account ID"
  type        = string
  sensitive   = true
}

variable "d1_database_name" {
  description = "Name of the D1 database"
  type        = string
  default     = "hookwing-db"
}
