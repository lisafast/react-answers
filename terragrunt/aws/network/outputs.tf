output "vpc_id" {
  description = "The VPC id"
  value       = module.ai_answers_vpc.vpc_id
}

output "vpc_private_subnet_ids" {
  description = "List of the React Answers app VPC private subnet ids"
  value       = module.ai_answers_vpc.private_subnet_ids
}

output "vpc_public_subnet_ids" {
  description = "List of the React Answers App VPC public subnet ids"
  value       = module.ai_answers_vpc.public_subnet_ids
}

output "vpc_cidr_block" {
  description = "List of cidr block ips for the React Answers VPC"
  value       = module.ai_answers_vpc.cidr_block
}


output "app_security_group_id" {
  description = "App security group Id for the react answers app"
  value       = aws_security_group.app.id
}