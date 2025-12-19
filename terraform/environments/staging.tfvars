# Staging Environment Variables
# Terraform configuration for Screenshot_Algo staging environment

# =============================================================================
# General
# =============================================================================
environment  = "staging"
aws_region   = "eu-central-1"
project_name = "screenshot-algo"

# =============================================================================
# Networking
# =============================================================================
vpc_cidr = "10.1.0.0/16"

# =============================================================================
# EKS
# =============================================================================
eks_cluster_version     = "1.28"
eks_node_instance_types = ["t3.large", "t3.medium"]
eks_node_min_size       = 2
eks_node_max_size       = 6
eks_node_desired_size   = 3

# =============================================================================
# Database
# =============================================================================
db_instance_class          = "db.t3.medium"
db_allocated_storage       = 50
db_max_allocated_storage   = 200
db_engine_version          = "15.4"
db_multi_az                = false
db_backup_retention_period = 7
db_deletion_protection     = false

# =============================================================================
# Redis
# =============================================================================
redis_node_type       = "cache.t3.small"
redis_num_cache_nodes = 1
redis_engine_version  = "7.0"

# =============================================================================
# S3
# =============================================================================
s3_versioning                = true
s3_lifecycle_glacier_days    = 60
s3_lifecycle_expiration_days = 180

# =============================================================================
# Monitoring
# =============================================================================
enable_cloudwatch_logs    = true
log_retention_days        = 14
enable_container_insights = true

# =============================================================================
# Security
# =============================================================================
enable_waf = true

# =============================================================================
# Tags
# =============================================================================
additional_tags = {
  CostCenter = "staging"
  Team       = "platform"
}
