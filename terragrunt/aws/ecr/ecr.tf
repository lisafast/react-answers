resource "aws_ecr_repository" "ai_answers" {
  name                 = "ai-answers"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}