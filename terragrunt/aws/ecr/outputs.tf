output "ecr_repository_url" {
  description = "URL of the React Answers ECR"
  value       = aws_ecr_repository.ai_answers.repository_url
}

output "ecr_repository_arn" {
  description = "Arn of the ECR Repository"
  value       = aws_ecr_repository.ai_answers.arn
}