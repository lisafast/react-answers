# 
# Hosted zone for React Answers app
#

resource "aws_route53_zone" "ai_answers" {
  name = var.domain

  tags = {
    CostCentre = var.billing_code
    Terraform  = true
  }
}