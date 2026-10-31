# ECR Container Repositories
resource "aws_ecr_repository" "frontend" {
  name                 = "totoro-frontend"
  image_tag_mutability = "MUTABLE"
}

resource "aws_ecr_repository" "backend" {
  name                 = "totoro-backend"
  image_tag_mutability = "MUTABLE"
}