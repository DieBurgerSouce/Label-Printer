# Production Environment Variables
# Terraform configuration for Screenshot_Algo production environment

# =============================================================================
# General
# =============================================================================
environment  = "production"
aws_region   = "eu-central-1"
project_name = "screenshot-algo"

# =============================================================================
# Networking
# =============================================================================
vpc_cidr = "10.2.0.0/16"

# =============================================================================
# EKS
# =============================================================================
eks_cluster_version     = "1.28"
eks_node_instance_types = ["m6i.xlarge", "m5.xlarge"]
eks_node_min_size       = 3
eks_node_max_size       = 20
eks_node_desired_size   = 5

# =============================================================================
# Database
# =============================================================================
db_instance_class          = "db.r6g.xlarge"
db_allocated_storage       = 100
db_max_allocated_storage   = 1000
db_engine_version          = "15.4"
db_multi_az                = true
db_backup_retention_period = 30
db_deletion_protection     = true

# =============================================================================
# Redis
# =============================================================================
redis_node_type       = "cache.r6g.large"
redis_num_cache_nodes = 2
redis_engine_version  = "7.0"

# =============================================================================
# S3
# =============================================================================
s3_versioning                = true
s3_lifecycle_glacier_days    = 90
s3_lifecycle_expiration_days = 365

# =============================================================================
# Monitoring
# =============================================================================
enable_cloudwatch_logs    = true
log_retention_days        = 90
enable_container_insights = true

# =============================================================================
# Security
# =============================================================================
enable_waf = true

allowed_cidr_blocks = [
  # Add trusted IP ranges
]

# =============================================================================
# Tags
# =============================================================================
additional_tags = {
  CostCenter  = "production"
  Team        = "platform"
  Compliance  = "SOC2"
  DataClass   = "confidential"
}
