resource "aws_ecr_repository" "ai_answers" {
  name                 = "${var.product_name}-${var.env}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}