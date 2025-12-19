# Terraform Outputs
# Enterprise output definitions for Screenshot_Algo

# =============================================================================
# Networking Outputs
# =============================================================================
output "networking" {
  description = "Networking module outputs"
  value = {
    vpc_id              = module.networking.vpc_id
    vpc_cidr            = module.networking.vpc_cidr
    public_subnet_ids   = module.networking.public_subnet_ids
    private_subnet_ids  = module.networking.private_subnet_ids
    database_subnet_ids = module.networking.database_subnet_ids
    nat_gateway_ips     = module.networking.nat_gateway_ips
  }
}

# =============================================================================
# Compute (EKS) Outputs
# =============================================================================
output "eks" {
  description = "EKS cluster outputs"
  value = {
    cluster_name                   = module.compute.eks_cluster_name
    cluster_endpoint               = module.compute.eks_cluster_endpoint
    cluster_security_group_id      = module.compute.eks_cluster_security_group_id
    cluster_iam_role_arn           = module.compute.eks_cluster_iam_role_arn
    node_security_group_id         = module.compute.eks_node_security_group_id
    oidc_provider_arn              = module.compute.eks_oidc_provider_arn
  }
  sensitive = true
}

output "kubeconfig_command" {
  description = "Command to update kubeconfig"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.compute.eks_cluster_name}"
}

# =============================================================================
# Database Outputs
# =============================================================================
output "database" {
  description = "Database module outputs"
  value = {
    endpoint        = module.database.endpoint
    port            = module.database.port
    database_name   = module.database.database_name
    username        = module.database.username
    security_group  = module.database.security_group_id
  }
  sensitive = true
}

output "database_connection_string" {
  description = "Database connection string (without password)"
  value       = "postgresql://${module.database.username}:<password>@${module.database.endpoint}:${module.database.port}/${module.database.database_name}"
  sensitive   = true
}

# =============================================================================
# Storage Outputs
# =============================================================================
output "storage" {
  description = "Storage module outputs"
  value = {
    s3_bucket_name   = module.storage.s3_bucket_name
    s3_bucket_arn    = module.storage.s3_bucket_arn
    s3_bucket_domain = module.storage.s3_bucket_domain
    redis_endpoint   = module.storage.redis_endpoint
    redis_port       = module.storage.redis_port
  }
  sensitive = true
}

# =============================================================================
# Summary Output
# =============================================================================
output "summary" {
  description = "Infrastructure summary"
  value = {
    environment = var.environment
    region      = var.aws_region
    vpc_id      = module.networking.vpc_id
    eks_cluster = module.compute.eks_cluster_name
  }
}

# =============================================================================
# Kubernetes Configuration Outputs
# =============================================================================
output "kubernetes_config" {
  description = "Kubernetes configuration values for Helm"
  value = {
    database_host     = module.database.endpoint
    database_port     = module.database.port
    database_name     = module.database.database_name
    redis_host        = module.storage.redis_endpoint
    redis_port        = module.storage.redis_port
    s3_bucket         = module.storage.s3_bucket_name
    aws_region        = var.aws_region
  }
  sensitive = true
}
