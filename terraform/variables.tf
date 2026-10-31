variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS Deployment Region"
}

variable "db_password" {
  type        = string
  sensitive   = true
  default     = "TotoroSecurePass2026!"
  description = "Master Password for AWS RDS PostgreSQL"
}