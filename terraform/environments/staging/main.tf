# Staging Environment

module "hookwing_staging" {
  source = "../../modules/hookwing"
  
  environment   = "staging"
  account_id    = var.account_id
  d1_name       = "hookwing-staging-db"
  
  enable_d1     = true
  enable_workers = true
  enable_queues  = true
}

output "environment" {
  value = "staging"
}

output "d1_database_id" {
  value = module.hookwing_staging.d1_database_id
  sensitive = true
}
