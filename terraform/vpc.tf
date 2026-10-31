module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.0"

  name = "totoro-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  # Enable NAT Gateway for EKS Private Subnet outbound Internet access
  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true
  enable_dns_support   = true

  # Subnet tagging required for AWS Load Balancer Controller discovery
  public_subnet_tags = {
    "kubernetes.io/cluster/totoro-eks-cluster" = "shared"
    "kubernetes.io/role/elb"                  = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/totoro-eks-cluster" = "shared"
    "kubernetes.io/role/internal-elb"         = "1"
  }
}