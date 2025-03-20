# IAM Role definitions

# Policy for ECS task role
data "aws_iam_policy_document" "ai-answers-ecs-policy" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "ai-answers-ssm-policy" {
  statement {
    sid    = "AllowSSMParameterAccess"
    effect = "Allow"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath"
    ]
    resources = [
      var.docdb_password_arn,
      var.docdb_username_arn,
      var.azure_openai_api_key_arn,
      var.azure_openai_endpoint_arn,
      var.azure_openai_api_version_arn,
      var.canada_ca_search_uri_arn,
      var.canada_ca_search_api_key_arn,
      var.user_agent_arn,
      var.jwt_secret_key_arn,
      var.docdb_uri_arn
    ]
  }
}

resource "aws_iam_policy" "ai-answers-ssm-policy" {
  name        = "ai-answers-ssm-policy"
  description = "Policy for AI Answers to access SSM parameters"
  policy      = data.aws_iam_policy_document.ai-answers-ssm-policy.json

  tags = {
    CostCentre = var.billing_code
    Terraform  = true
  }
}

resource "aws_iam_role" "ai-answers-ecs-role" {
  name               = "ai-answers-ecs-role"
  assume_role_policy = data.aws_iam_policy_document.ai-answers-ecs-policy.json
}

resource "aws_iam_role_policy_attachment" "ai-answers-ecs-policy" {
  role       = aws_iam_role.ai-answers-ecs-role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_policy_attachment" "ai-answers-ssm-policy" {
  name       = "ai-answers-ssm-policy"
  policy_arn = aws_iam_policy.ai-answers-ssm-policy.arn
  roles      = [aws_iam_role.ai-answers-ecs-role.name]
}