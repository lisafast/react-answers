resource "aws_security_group" "ai_answers_load_balancer_sg" {
  name        = "${var.product_name}-${var.env}-load-balancer-sg"
  description = "Security group for ${var.product_name} ${var.env} load balancer"
  vpc_id      = var.vpc_id

  ingress {
    protocol    = "tcp"
    from_port   = 443
    to_port     = 443
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTPS inbound traffic"
  }
  egress {
    protocol    = "tcp"
    from_port   = 3001
    to_port     = 3001
    cidr_blocks = [var.vpc_cidr_block] #tfsec:ignore:AWS008
  }

  tags = {
    CostCentre = var.billing_code
  }
}