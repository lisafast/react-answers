output "hosted_zone_id" {
  description = "Route53 hosted zone ID that will hold our DNS records"
  value       = aws_route53_zone.ai_answers.zone_id
}

output "hosted_zone_name" {
  description = "Route53 hosted zone name that will hold our DNS records"
  value       = aws_route53_zone.ai_answers.name
}