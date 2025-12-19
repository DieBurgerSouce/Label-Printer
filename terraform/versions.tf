# Terraform Version Constraints
# Enterprise version pinning for Screenshot_Algo

terraform {
  # Terraform version constraint
  required_version = ">= 1.5.0, < 2.0.0"

  # Provider version constraints
  required_providers {
    # AWS Provider
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0, < 6.0.0"
    }

    # Kubernetes Provider
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.23.0, < 3.0.0"
    }

    # Helm Provider
    helm = {
      source  = "hashicorp/helm"
      version = ">= 2.11.0, < 3.0.0"
    }

    # Random Provider (for password generation, etc.)
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5.0, < 4.0.0"
    }

    # TLS Provider (for certificate generation)
    tls = {
      source  = "hashicorp/tls"
      version = ">= 4.0.0, < 5.0.0"
    }

    # Null Provider (for local-exec, etc.)
    null = {
      source  = "hashicorp/null"
      version = ">= 3.2.0, < 4.0.0"
    }

    # Archive Provider (for Lambda deployments)
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.4.0, < 3.0.0"
    }

    # Local Provider (for local files)
    local = {
      source  = "hashicorp/local"
      version = ">= 2.4.0, < 3.0.0"
    }

    # Time Provider (for time-based resources)
    time = {
      source  = "hashicorp/time"
      version = ">= 0.9.0, < 1.0.0"
    }
  }
}
