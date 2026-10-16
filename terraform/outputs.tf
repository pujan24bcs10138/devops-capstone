output "cluster_name" {
  description = "EKS Cluster Name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS Cluster API Endpoint"
  value       = module.eks.cluster_endpoint
}

output "vpc_id" {
  description = "VPC ID where cluster is provisioned"
  value       = module.vpc.vpc_id
}

output "provisioned_facilities" {
  description = "Regional warehouse facilities discovered by LogiTrack application"
  value       = var.warehouse_facilities
}

