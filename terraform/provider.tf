terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket         = "totoro-tf-state-112613577929"
    key            = "totoro/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "totoro-tf-locks"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Totoro"
      Environment = "Production"
      ManagedBy   = "Terraform"
    }
  }
}