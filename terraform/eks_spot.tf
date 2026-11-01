module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "totoro-eks-cluster"
  cluster_version = "1.30"

  cluster_endpoint_public_access = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    spot_nodes = {
      min_size     = 2
      max_size     = 4
      desired_size = 2

      instance_types = ["t3.small"]
      capacity_type  = "SPOT" # Maximizes cost savings on AWS Spot pool
    }
  }
}

# IAM policy allowing EKS pods to read Secrets Manager resources
resource "aws_iam_policy" "secrets_read_policy" {
  name        = "totoro-eks-secrets-read"
  description = "Allow EKS pods to retrieve secrets from AWS Secrets Manager"

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
        Resource = [aws_kms_key.totoro_key.arn]
      }
    ]
  })
}

# Attach IAM policy to EKS Managed Spot Node Group role
resource "aws_iam_role_policy_attachment" "eks_secrets_attach" {
  role       = module.eks.eks_managed_node_groups["spot_nodes"].iam_role_name
  policy_arn = aws_iam_policy.secrets_read_policy.arn
}