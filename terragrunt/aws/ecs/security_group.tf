###
# Security groups for ECS
###

resource "aws_security_group" "ecs_tasks" {
  name        = "ai-answers-security-group"
  description = "Allow inbound and outbound traffic for AI Answers"
  vpc_id      = var.vpc_id

  tags = {
    "CostCentre" = var.billing_code
  }
}

resource "aws_vpc_security_group_ingress_rule" "ecs_ingress_lb" {
  security_group_id = aws_security_group.ecs_tasks.id
  cidr_ipv4         = var.vpc_cidr_block
  from_port         = 3001
  to_port           = 3001
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "ecs_egress_all" {
  #checkov:skip=CKV_AWS_382 # We need to allow all traffic for ECS to work
  security_group_id = aws_security_group.ecs_tasks.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"

  description = "Allow ECS security group to send all traffic"
}

###
# Traffic to DocumentDB should only come from ECS
###

resource "aws_security_group_rule" "ecs_egress_database" {
  description              = "Allow ECS to talk to the DocumentDB cluster"
  type                     = "egress"
  from_port                = 27017
  to_port                  = 27017
  protocol                 = "tcp"
  source_security_group_id = var.aws_docdb_security_group_id
  security_group_id        = aws_security_group.ecs_tasks.id
}

resource "aws_security_group_rule" "database_ingress_ecs" {
  description              = "Allow DocumentDB cluster to receive requests from ECS"
  type                     = "ingress"
  from_port                = 27017
  to_port                  = 27017
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
  security_group_id        = var.aws_docdb_security_group_id
}