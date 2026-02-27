# Production Environment

module "hookwing_prod" {
  source = "../../modules/hookwing"
  
  environment   = "prod"
  account_id    = var.account_id
  d1_name       = "hookwing-db"
  
  enable_d1     = true
  enable_workers = true
  enable_queues  = true
}

output "environment" {
  value = "prod"
}

output "d1_database_id" {
  value = module.hookwing_prod.d1_database_id
  sensitive = true
}
