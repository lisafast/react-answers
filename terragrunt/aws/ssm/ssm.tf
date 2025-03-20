resource "aws_ssm_parameter" "docdb_username" {
  name  = "docdb_username"
  type  = "SecureString"
  value = var.docdb_username

  tags = {
    CostCentre = var.billing_code
    Terraform  = true
  }
}

resource "aws_ssm_parameter" "docdb_password" {
  name  = "docdb_password"
  type  = "SecureString"
  value = var.docdb_password

  tags = {
    CostCentre = var.billing_code
    Terraform  = true
  }
}

resource "aws_ssm_parameter" "azure_openai_api_key" {
  name  = "azure_openai_api_key"
  type  = "SecureString"
  value = var.azure_openai_api_key
}

resource "aws_ssm_parameter" "azure_openai_endpoint" {
  name  = "azure_openai_endpoint"
  type  = "SecureString"
  value = var.azure_openai_endpoint
}

resource "aws_ssm_parameter" "azure_openai_api_version" {
  name  = "azure_openai_api_version"
  type  = "SecureString"
  value = var.azure_openai_api_version
}

resource "aws_ssm_parameter" "canada_ca_search_uri" {
  name  = "canada_ca_search_uri"
  type  = "SecureString"
  value = var.canada_ca_search_uri
}

resource "aws_ssm_parameter" "canada_ca_search_api_key" {
  name  = "canada_ca_search_api_key"
  type  = "SecureString"
  value = var.canada_ca_search_api_key
}

resource "aws_ssm_parameter" "user_agent" {
  name  = "user_agent"
  type  = "SecureString"
  value = var.user_agent
}

resource "aws_ssm_parameter" "jwt_secret_key" {
  name  = "jwt_secret_key"
  type  = "SecureString"
  value = var.jwt_secret_key
}