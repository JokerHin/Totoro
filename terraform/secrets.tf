# 1. KMS Key for encrypting secrets
resource "aws_kms_key" "totoro_key" {
  description             = "KMS Key for Totoro Application Secrets"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "totoro-kms-key"
  }
}

# 2. Secret container for Groq API Key (Empty Shell)
resource "aws_secretsmanager_secret" "groq_api_key" {
  name        = "totoro/groq-api-key"
  description = "Groq API Key container for Totoro AI"
  kms_key_id  = aws_kms_key.totoro_key.arn
}

# 3. Secret container for Database Credentials (Empty Shell)
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "totoro/db-credentials"
  description = "RDS Database credentials container"
  kms_key_id  = aws_kms_key.totoro_key.arn
}