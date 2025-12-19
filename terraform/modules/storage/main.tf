# Terraform Storage Module
# S3 and ElastiCache configuration for Screenshot_Algo

# =============================================================================
# Variables
# =============================================================================
variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs"
  type        = list(string)
}

variable "enable_s3_bucket" {
  description = "Enable S3 bucket creation"
  type        = bool
  default     = true
}

variable "s3_versioning" {
  description = "Enable S3 versioning"
  type        = bool
  default     = true
}

variable "s3_lifecycle_rules" {
  description = "S3 lifecycle rules"
  type        = list(any)
  default     = []
}

variable "enable_redis" {
  description = "Enable ElastiCache Redis"
  type        = bool
  default     = true
}

variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of Redis nodes"
  type        = number
  default     = 1
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "allowed_security_groups" {
  description = "Security groups allowed to access resources"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}

# =============================================================================
# Local Variables
# =============================================================================
locals {
  bucket_name = "${var.name_prefix}-${var.environment}-storage"
}

# =============================================================================
# S3 Bucket
# =============================================================================
resource "aws_s3_bucket" "main" {
  count = var.enable_s3_bucket ? 1 : 0

  bucket = local.bucket_name

  tags = merge(var.tags, {
    Name = local.bucket_name
  })
}

resource "aws_s3_bucket_versioning" "main" {
  count = var.enable_s3_bucket ? 1 : 0

  bucket = aws_s3_bucket.main[0].id

  versioning_configuration {
    status = var.s3_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  count = var.enable_s3_bucket ? 1 : 0

  bucket = aws_s3_bucket.main[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "main" {
  count = var.enable_s3_bucket ? 1 : 0

  bucket = aws_s3_bucket.main[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "main" {
  count = var.enable_s3_bucket && length(var.s3_lifecycle_rules) > 0 ? 1 : 0

  bucket = aws_s3_bucket.main[0].id

  dynamic "rule" {
    for_each = var.s3_lifecycle_rules

    content {
      id     = rule.value.id
      status = rule.value.enabled ? "Enabled" : "Disabled"

      dynamic "transition" {
        for_each = lookup(rule.value, "transition", null) != null ? [rule.value.transition] : []

        content {
          days          = transition.value.days
          storage_class = transition.value.storage_class
        }
      }

      dynamic "expiration" {
        for_each = lookup(rule.value, "expiration", null) != null ? [rule.value.expiration] : []

        content {
          days = expiration.value.days
        }
      }
    }
  }
}

# =============================================================================
# ElastiCache Redis
# =============================================================================
resource "aws_security_group" "redis" {
  count = var.enable_redis ? 1 : 0

  name        = "${var.name_prefix}-${var.environment}-redis"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-${var.environment}-redis"
  })
}

resource "aws_security_group_rule" "redis_ingress" {
  count = var.enable_redis ? length(var.allowed_security_groups) : 0

  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  security_group_id        = aws_security_group.redis[0].id
  source_security_group_id = var.allowed_security_groups[count.index]
}

resource "aws_elasticache_subnet_group" "main" {
  count = var.enable_redis ? 1 : 0

  name       = "${var.name_prefix}-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = var.tags
}

resource "aws_elasticache_parameter_group" "main" {
  count = var.enable_redis ? 1 : 0

  name   = "${var.name_prefix}-${var.environment}-redis7"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  tags = var.tags
}

resource "random_password" "redis" {
  count = var.enable_redis ? 1 : 0

  length  = 32
  special = false
}

resource "aws_elasticache_replication_group" "main" {
  count = var.enable_redis ? 1 : 0

  replication_group_id = "${var.name_prefix}-${var.environment}"
  description          = "Redis cluster for ${var.name_prefix}"

  engine               = "redis"
  engine_version       = var.redis_engine_version
  node_type            = var.redis_node_type
  num_cache_clusters   = var.redis_num_cache_nodes
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.main[0].name

  subnet_group_name  = aws_elasticache_subnet_group.main[0].name
  security_group_ids = [aws_security_group.redis[0].id]

  # Encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis[0].result

  # Maintenance
  maintenance_window       = "sun:05:00-sun:06:00"
  snapshot_window          = "03:00-04:00"
  snapshot_retention_limit = var.environment == "production" ? 7 : 1
  auto_minor_version_upgrade = true

  tags = var.tags
}

# =============================================================================
# Secrets Manager for Redis Auth Token
# =============================================================================
resource "aws_secretsmanager_secret" "redis" {
  count = var.enable_redis ? 1 : 0

  name        = "${var.name_prefix}/${var.environment}/redis"
  description = "Redis auth token for ${var.name_prefix}"

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "redis" {
  count = var.enable_redis ? 1 : 0

  secret_id = aws_secretsmanager_secret.redis[0].id
  secret_string = jsonencode({
    auth_token = random_password.redis[0].result
    host       = aws_elasticache_replication_group.main[0].primary_endpoint_address
    port       = 6379
  })
}

# =============================================================================
# Outputs
# =============================================================================
output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = var.enable_s3_bucket ? aws_s3_bucket.main[0].id : null
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = var.enable_s3_bucket ? aws_s3_bucket.main[0].arn : null
}

output "s3_bucket_domain" {
  description = "S3 bucket domain name"
  value       = var.enable_s3_bucket ? aws_s3_bucket.main[0].bucket_domain_name : null
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = var.enable_redis ? aws_elasticache_replication_group.main[0].primary_endpoint_address : null
}

output "redis_port" {
  description = "Redis port"
  value       = var.enable_redis ? 6379 : null
}

output "redis_secret_arn" {
  description = "Redis secret ARN"
  value       = var.enable_redis ? aws_secretsmanager_secret.redis[0].arn : null
}
