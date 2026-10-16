variable "aws_region" {
  description = "AWS region for provisioning infrastructure"
  type        = string
  default     = "ap-south-1"
}

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "logitrack-eks"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "warehouse_facilities" {
  description = "Regional warehouse facilities provisioned via Terraform IaC"
  type = map(object({
    name           = string
    region         = string
    location       = string
    aisles         = string
    storage_util   = number
    dispatch_sla   = string
    facility_role  = string
  }))
  default = {
    "mum-central" = {
      name          = "Central Hub — Mumbai A1"
      region        = "ap-south-1 (Primary AWS Region)"
      location      = "Western Express, Mumbai"
      aisles        = "Aisles 1–12"
      storage_util  = 78
      dispatch_sla  = "99.8%"
      facility_role = "Primary Regional Distribution Hub"
    },
    "blr-node" = {
      name          = "Fulfillment Node — Bangalore B2"
      region        = "ap-south-1 (Secondary Tech Hub)"
      location      = "Electronic City, Bangalore"
      aisles        = "Aisles 13–24"
      storage_util  = 62
      dispatch_sla  = "99.4%"
      facility_role = "Tech & High-Value Fulfillment Node"
    },
    "pun-overflow" = {
      name          = "Overflow Facility — Pune C1"
      region        = "ap-south-1 (Heavy Cargo Zone)"
      location      = "Chakan MIDC, Pune"
      aisles        = "Zones A–D"
      storage_util  = 45
      dispatch_sla  = "98.9%"
      facility_role = "Overflow & Heavy Equipment Storage"
    }
  }
}

