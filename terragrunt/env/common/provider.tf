terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region              = var.region
  allowed_account_ids = [var.account_id]
  # add default tags to all resources at creation or update
  default_tags {
    tags = var.default_tags
  }
}

provider "aws" {
  alias               = "us-east-1"
  region              = "us-east-1"
  allowed_account_ids = [var.account_id]
  # add default tags to all resources at creation or update
  default_tags {
    tags = var.default_tags
  }
}
