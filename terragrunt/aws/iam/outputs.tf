output "iam_role_ai-answers-ecs-role_arn" {
  description = "The ARN of the IAM role for the AI Answers ECS task"
  value       = aws_iam_role.ai-answers-ecs-role.arn
}

output "ai-answers-ecs-policy_attachment" {
  description = "ECS Task policy attachment IAM Role"
  value       = aws_iam_role_policy_attachment.ai-answers-ecs-policy
}
