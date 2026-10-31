# Security group for external Application Load Balancer
resource "aws_security_group" "alb_sg" {
  name        = "totoro-alb-sg"
  description = "Allow inbound HTTP/HTTPS traffic to ALB"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "Allow HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}