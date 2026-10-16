import json
import os
from typing import List, Dict, Any

DEFAULT_FACILITIES: List[Dict[str, Any]] = [
    {
        "id": "mum-central",
        "name": "Central Hub — Mumbai A1",
        "region": "ap-south-1 (Primary AWS Region)",
        "location": "Western Express, Mumbai",
        "aisles": "Aisles 1–12",
        "status": "Operational",
        "storage_utilization": 78,
        "dispatch_sla": "99.8%",
        "provisioner": "Terraform AWS VPC Module v5.8.1",
        "cluster_name": "logitrack-eks-ap-south-1",
    },
    {
        "id": "blr-node",
        "name": "Fulfillment Node — Bangalore B2",
        "region": "ap-south-1 (Secondary Tech Hub)",
        "location": "Electronic City, Bangalore",
        "aisles": "Aisles 13–24",
        "status": "Operational",
        "storage_utilization": 62,
        "dispatch_sla": "99.4%",
        "provisioner": "Terraform AWS VPC Module v5.8.1",
        "cluster_name": "logitrack-eks-ap-south-1",
    },
    {
        "id": "pun-overflow",
        "name": "Overflow Facility — Pune C1",
        "region": "ap-south-1 (Heavy Cargo Zone)",
        "location": "Chakan MIDC, Pune",
        "aisles": "Zones A–D",
        "status": "Operational",
        "storage_utilization": 45,
        "dispatch_sla": "98.9%",
        "provisioner": "Terraform AWS VPC Module v5.8.1",
        "cluster_name": "logitrack-eks-ap-south-1",
    },
]

# In-memory registry cache initialized with defaults or env config
_registry: List[Dict[str, Any]] = list(DEFAULT_FACILITIES)

def get_facility_registry() -> List[Dict[str, Any]]:
    global _registry
    # If environment variable or ConfigMap is mounted, read from it
    env_config = os.getenv("WAREHOUSE_REGISTRY_JSON")
    if env_config:
        try:
            parsed = json.loads(env_config)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass

    config_file = os.getenv("WAREHOUSE_CONFIG_PATH", "/etc/config/facilities.json")
    if os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                parsed = json.load(f)
                if isinstance(parsed, list):
                    return parsed
        except Exception:
            pass

    return _registry

def register_facility(facility: Dict[str, Any]) -> Dict[str, Any]:
    global _registry
    # Check if existing
    for idx, f in enumerate(_registry):
        if f["id"] == facility["id"]:
            _registry[idx] = facility
            return facility
    _registry.append(facility)
    return facility

def reset_facility_registry() -> None:
    global _registry
    _registry = list(DEFAULT_FACILITIES)
