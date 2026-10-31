# DB Subnet Group
resource "aws_db_subnet_group" "totoro_db_subnets" {
  name       = "totoro-db-subnets"
  subnet_ids = module.vpc.private_subnets
}

# DB Security Group
resource "aws_security_group" "rds_sg" {
  name        = "totoro-rds-sg"
  description = "Allow EKS cluster pods access to PostgreSQL"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "totoro_rds" {
  identifier             = "totoro-db"
  allocated_storage      = 20
  engine                 = "postgres"
  engine_version         = "15"
  instance_class         = "db.t4g.micro"
  db_name                = "totorodb"
  username               = "totoro_admin"
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.totoro_db_subnets.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  skip_final_snapshot    = true
}