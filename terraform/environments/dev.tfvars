# Development Environment Variables
# Terraform configuration for Screenshot_Algo dev environment

# =============================================================================
# General
# =============================================================================
environment  = "dev"
aws_region   = "eu-central-1"
project_name = "screenshot-algo"

# =============================================================================
# Networking
# =============================================================================
vpc_cidr = "10.0.0.0/16"

# =============================================================================
# EKS
# =============================================================================
eks_cluster_version     = "1.28"
eks_node_instance_types = ["t3.medium"]
eks_node_min_size       = 1
eks_node_max_size       = 3
eks_node_desired_size   = 2

# =============================================================================
# Database
# =============================================================================
db_instance_class          = "db.t3.micro"
db_allocated_storage       = 20
db_max_allocated_storage   = 50
db_engine_version          = "15.4"
db_multi_az                = false
db_backup_retention_period = 3
db_deletion_protection     = false

# =============================================================================
# Redis
# =============================================================================
redis_node_type       = "cache.t3.micro"
redis_num_cache_nodes = 1
redis_engine_version  = "7.0"

# =============================================================================
# S3
# =============================================================================
s3_versioning                = false
s3_lifecycle_glacier_days    = 30
s3_lifecycle_expiration_days = 90

# =============================================================================
# Monitoring
# =============================================================================
enable_cloudwatch_logs    = true
log_retention_days        = 7
enable_container_insights = true

# =============================================================================
# Security
# =============================================================================
enable_waf = false

# =============================================================================
# Tags
# =============================================================================
additional_tags = {
  CostCenter = "development"
  Team       = "platform"
}
