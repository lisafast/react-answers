#
# Terraform code to create an Amazon DocumentDB cluster 
#

# Retrieve the username and password from the SSM parameter store
data "aws_ssm_parameter" "docdb_username" {
  name = var.docdb_username_name
}

data "aws_ssm_parameter" "docdb_password" {
  name = var.docdb_password_name
}

# Create a security group for the DocumentDB cluster
resource "aws_security_group" "ai-answers-docdb-sg" {
  name        = "ai-answers-example-docdb-sg"
  description = "Security group for DocumentDB for the AI Answers app"
  vpc_id      = var.vpc_id

  # Inbound rules (ingress): Allow traffic on the DocDB port (27017) from your VPC CIDR
  ingress {
    from_port   = 27017
    to_port     = 27017
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr_block]
  }

  # Outbound rules (egress): Allow all traffic outbound but only to destinations within the cidr block. 
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr_block]
  }
  tags = {
    CostCentre = var.billing_code
    Terraform  = true
  }
}

# DocumentDB Subnet Group
resource "aws_docdb_subnet_group" "ai-answers-docdb-subnet-group" {
  name        = "ai-answers-example-docdb-subnet-group"
  description = "Subnet group for DocumentDB for the AI Answers app"

  subnet_ids = var.vpc_private_subnet_ids

  tags = {
    CostCentre = var.billing_code
    Terraform  = true
  }
}

# DocumentDB Cluster Parameter Group
resource "aws_docdb_cluster_parameter_group" "ai-answers-docdb-cluster-parameter-group" {
  name        = "ai-asnwers-docdb-cluster-parameter-group"
  family      = "docdb5.0" # Latest engine version
  description = "Parameter group for DocumentDB"

  # Parameter overrides. Enabled TLS encryption.
  parameter {
    name  = "tls"
    value = "enabled"
  }
  tags = {
    CostCentre = var.billing_code
    Terraform  = true
  }
}

# DocumentDB Cluster
resource "aws_docdb_cluster" "ai-answers-docdb-cluster" {
  cluster_identifier              = "ai-answers-docdb-cluster"
  engine                          = "docdb"
  engine_version                  = "5.0.0" # DocDB engine version
  master_username                 = data.aws_ssm_parameter.docdb_username.value
  master_password                 = data.aws_ssm_parameter.docdb_password.value
  db_subnet_group_name            = aws_docdb_subnet_group.ai-answers-docdb-subnet-group.name
  vpc_security_group_ids          = [aws_security_group.ai-answers-docdb-sg.id] # SG for the DocumentDB cluster
  storage_encrypted               = true
  apply_immediately               = true
  skip_final_snapshot             = true
  port                            = 27017
  db_cluster_parameter_group_name = aws_docdb_cluster_parameter_group.ai-answers-docdb-cluster-parameter-group.name

  tags = {
    CostCentre = var.billing_code
    Terraform  = true
  }
}

# DocumentDB Cluster Instance
resource "aws_docdb_cluster_instance" "ai-answers-docdb-instance" {
  count              = var.docdb_instane_count
  identifier         = "ai-answers-docdb-instance"
  cluster_identifier = aws_docdb_cluster.ai-answers-docdb-cluster.id
  instance_class     = "db.t3.medium" # We are using the smallest instance class for now and can scale later. 
  engine             = "docdb"
  apply_immediately  = true

  tags = {
    CostCentre = var.billing_code
    Terraform  = true
  }
}

# Create an ssm parameter to store the docdb uri
resource "aws_ssm_parameter" "docdb_uri" {
  name       = "docdb_uri"
  type       = "SecureString"
  value      = "mongodb://${data.aws_ssm_parameter.docdb_username.value}:${data.aws_ssm_parameter.docdb_password.value}@${aws_docdb_cluster.ai-answers-docdb-cluster.endpoint}:27017/?tls=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false"
  depends_on = [aws_docdb_cluster_instance.ai-answers-docdb-instance]
}