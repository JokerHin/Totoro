module "eks" {
  source          = "terraform-aws-modules/eks/aws"
  version         = "~> 21.29"
  cluster_name    = "totoro-eks-cluster"
  cluster_version = "1.31"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    spot_nodes = {
      instance_types = ["t3.micro", "t2.micro"]
      capacity_type  = "SPOT"
      ami_type       = "AL2_x86_64"

      min_size     = 2
      max_size     = 3
      desired_size = 2
    }
  }

  tags = {
    Environment = "production"
    Project     = "Totoro"
  }
}

# 1. Groq API Key Secret in Secrets Manager
resource "aws_secretsmanager_secret" "groq_api_key" {
  name                    = "totoro/groq-api-key"
  recovery_window_in_days = 0

  tags = {
    Environment = "production"
    Project     = "Totoro"
  }
}

resource "aws_secretsmanager_secret_version" "groq_api_key_version" {
  secret_id = aws_secretsmanager_secret.groq_api_key.id
  secret_string = jsonencode({
    GROQ_API_KEY = "dummy_or_provisioned_groq_api_key"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# 2. Reference secrets in IAM policy for IRSA / EKS pods
resource "aws_iam_policy" "secrets_read_policy" {
  name        = "totoro-eks-secrets-read-policy"
  description = "Allows EKS workloads to read Secrets Manager secrets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.groq_api_key.arn,
          aws_secretsmanager_secret.db_credentials.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "*"
      }
    ]
  })
}

# Attach IAM policy to EKS Managed Spot Node Group role
resource "aws_iam_role_policy_attachment" "eks_secrets_attach" {
  role       = module.eks.eks_managed_node_groups["spot_nodes"].iam_role_name
  policy_arn = aws_iam_policy.secrets_read_policy.arn
}
