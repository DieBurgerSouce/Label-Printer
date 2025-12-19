# Terraform Main Configuration
# Enterprise Infrastructure as Code for Screenshot_Algo
# AWS as default provider - adaptable to other clouds

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Backend configuration for remote state management
  # PRODUCTION: Uncomment this block after creating the S3 bucket and DynamoDB table
  # Run: terraform init -migrate-state to migrate existing state
  #
  # Pre-requisites (create manually or via bootstrap script):
  # 1. S3 bucket: screenshot-algo-terraform-state (with versioning enabled)
  # 2. DynamoDB table: screenshot-algo-terraform-locks (partition key: LockID)
  #
  # To enable:
  # 1. Uncomment the backend block below
  # 2. Run: terraform init -migrate-state
  # 3. Confirm state migration when prompted
  backend "s3" {
    bucket         = "screenshot-algo-terraform-state"
    key            = "state/terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    dynamodb_table = "screenshot-algo-terraform-locks"

    # Enable state locking
    # DynamoDB table schema: { LockID: String (Partition Key) }
  }
}

# =============================================================================
# Provider Configuration
# =============================================================================
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

provider "kubernetes" {
  host                   = module.compute.eks_cluster_endpoint
  cluster_ca_certificate = base64decode(module.compute.eks_cluster_ca_certificate)
  token                  = data.aws_eks_cluster_auth.cluster.token
}

provider "helm" {
  kubernetes {
    host                   = module.compute.eks_cluster_endpoint
    cluster_ca_certificate = base64decode(module.compute.eks_cluster_ca_certificate)
    token                  = data.aws_eks_cluster_auth.cluster.token
  }
}

# =============================================================================
# Data Sources
# =============================================================================
data "aws_eks_cluster_auth" "cluster" {
  name = module.compute.eks_cluster_name
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# =============================================================================
# Local Variables
# =============================================================================
locals {
  name_prefix = "screenshot-algo"
  environment = var.environment

  common_tags = {
    Project     = "Screenshot_Algo"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = "platform-team"
  }

  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)
}

# =============================================================================
# Networking Module
# =============================================================================
module "networking" {
  source = "./modules/networking"

  name_prefix        = local.name_prefix
  environment        = local.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = local.availability_zones

  enable_nat_gateway     = true
  single_nat_gateway     = var.environment != "production"
  enable_vpn_gateway     = false
  enable_dns_hostnames   = true
  enable_dns_support     = true

  tags = local.common_tags
}

# =============================================================================
# Compute Module (EKS)
# =============================================================================
module "compute" {
  source = "./modules/compute"

  name_prefix        = local.name_prefix
  environment        = local.environment
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids

  cluster_version = var.eks_cluster_version

  # Node groups
  node_groups = {
    application = {
      instance_types = var.environment == "production" ? ["m6i.xlarge", "m5.xlarge"] : ["t3.medium"]
      min_size       = var.environment == "production" ? 3 : 1
      max_size       = var.environment == "production" ? 20 : 5
      desired_size   = var.environment == "production" ? 5 : 2
      disk_size      = 100

      labels = {
        "node-type" = "application"
      }
    }
  }

  # Cluster addons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  tags = local.common_tags
}

# =============================================================================
# Database Module (RDS PostgreSQL)
# =============================================================================
module "database" {
  source = "./modules/database"

  name_prefix        = local.name_prefix
  environment        = local.environment
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids

  # RDS Configuration
  engine_version    = "15.4"
  instance_class    = var.environment == "production" ? "db.r6g.xlarge" : "db.t3.medium"
  allocated_storage = var.environment == "production" ? 100 : 20
  max_allocated_storage = var.environment == "production" ? 500 : 100

  # High availability
  multi_az               = var.environment == "production"
  backup_retention_period = var.environment == "production" ? 30 : 7
  deletion_protection    = var.environment == "production"

  # Security
  storage_encrypted = true

  # Access
  allowed_security_groups = [module.compute.eks_node_security_group_id]

  tags = local.common_tags
}

# =============================================================================
# Storage Module (S3, ElastiCache)
# =============================================================================
module "storage" {
  source = "./modules/storage"

  name_prefix = local.name_prefix
  environment = local.environment
  vpc_id      = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids

  # S3 Configuration
  enable_s3_bucket = true
  s3_versioning    = var.environment == "production"
  s3_lifecycle_rules = [
    {
      id      = "archive"
      enabled = true
      transition = {
        days          = 90
        storage_class = "GLACIER"
      }
      expiration = {
        days = 365
      }
    }
  ]

  # ElastiCache (Redis) Configuration
  enable_redis          = true
  redis_node_type       = var.environment == "production" ? "cache.r6g.large" : "cache.t3.micro"
  redis_num_cache_nodes = var.environment == "production" ? 2 : 1
  redis_engine_version  = "7.0"

  # Access
  allowed_security_groups = [module.compute.eks_node_security_group_id]

  tags = local.common_tags
}

# =============================================================================
# Outputs
# =============================================================================
output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.compute.eks_cluster_endpoint
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.compute.eks_cluster_name
}

output "database_endpoint" {
  description = "RDS database endpoint"
  value       = module.database.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = module.storage.redis_endpoint
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = module.storage.s3_bucket_name
}
