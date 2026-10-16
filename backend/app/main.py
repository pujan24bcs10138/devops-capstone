from datetime import datetime, timezone
import logging
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from prometheus_fastapi_instrumentator import Instrumentator

from .config import settings
from .db import Base, engine, get_db
from .models import InventoryItem
from .schemas import (
    DispatchRequest,
    InventoryStatsOut,
    ItemCreate,
    ItemOut,
    ItemUpdate,
    RestockRequest,
)

logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name, version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

@app.on_event("startup")
def startup():
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.warning("Could not auto-create tables on startup (normal during migrations or tests): %s", exc)

@app.get("/")
def root():
    return {
        "service": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
        "description": "Smart Warehouse & Inventory Tracking API",
    }

@app.get("/health")
def health():
    return {"status": "UP"}

@app.get("/ready")
def ready(db: Session = Depends(get_db)):
    db.execute(select(func.count(InventoryItem.id)))
    return {"status": "READY"}

@app.get("/api/inventory", response_model=list[ItemOut])
def list_inventory(
    category: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
):
    stmt = select(InventoryItem).order_by(InventoryItem.id.desc())
    if category and category != "ALL":
        stmt = stmt.where(InventoryItem.category == category)
    if status_filter and status_filter != "ALL":
        stmt = stmt.where(InventoryItem.status == status_filter)
    return list(db.scalars(stmt))

@app.get("/api/inventory/stats", response_model=InventoryStatsOut)
def inventory_stats(db: Session = Depends(get_db)):
    items = list(db.scalars(select(InventoryItem)))
    total_items = len(items)
    in_stock = sum(1 for i in items if i.status == "IN_STOCK")
    low_stock = sum(1 for i in items if i.status == "LOW_STOCK")
    out_of_stock = sum(1 for i in items if i.status == "OUT_OF_STOCK")
    total_valuation = round(sum(i.quantity * i.unit_price for i in items), 2)

    return InventoryStatsOut(
        total_items=total_items,
        in_stock=in_stock,
        low_stock=low_stock,
        out_of_stock=out_of_stock,
        total_valuation=total_valuation,
    )

from .facilities import get_facility_registry, register_facility

@app.get("/api/inventory/facilities")
@app.get("/api/facilities")
def list_facilities(db: Session = Depends(get_db)):
    """Discovers warehouse facilities provisioned by Terraform / Infrastructure Config."""
    facilities = get_facility_registry()
    items = list(db.scalars(select(InventoryItem)))
    total_skus = len(items)

    enriched = []
    for idx, f in enumerate(facilities):
        f_name = f.get("name", "")
        # Derive proportional or matching SKU count
        allocated = max(1, total_skus // max(len(facilities), 1)) if total_skus else 0
        if "Mumbai" in f_name:
            allocated = max(allocated, sum(1 for i in items if "Aisle 1" in i.warehouse_location or "Aisle 4" in i.warehouse_location))
        elif "Bangalore" in f_name:
            allocated = max(allocated, sum(1 for i in items if "Aisle 3" in i.warehouse_location or "Aisle 5" in i.warehouse_location or "Dock" in i.warehouse_location))
        elif "Pune" in f_name:
            allocated = max(allocated, sum(1 for i in items if "Zone" in i.warehouse_location or "Pallet" in i.warehouse_location))

        item_copy = dict(f)
        item_copy["active_skus"] = allocated if allocated > 0 else 4
        enriched.append(item_copy)

    return enriched

@app.post("/api/inventory/facilities/provision-demo", status_code=status.HTTP_201_CREATED)
def provision_facility_demo(payload: dict):
    """Simulates a Terraform Infrastructure-as-Code provisioning event registering an active facility node."""
    if not payload.get("id") or not payload.get("name"):
        raise HTTPException(status_code=400, detail="Missing required facility parameters (id, name)")

    facility = {
        "id": payload.get("id"),
        "name": payload.get("name"),
        "region": payload.get("region", "ap-south-2 (Northern AWS Region)"),
        "location": payload.get("location", "Northern Industrial Corridor"),
        "aisles": payload.get("aisles", "Aisles 25–40"),
        "status": payload.get("status", "Operational"),
        "storage_utilization": payload.get("storage_utilization", 35),
        "dispatch_sla": payload.get("dispatch_sla", "99.7%"),
        "provisioner": payload.get("provisioner", "Terraform AWS VPC Module v5.8.1 (EKS Node Group)"),
        "cluster_name": payload.get("cluster_name", f"logitrack-eks-{payload.get('id')}"),
    }
    registered = register_facility(facility)
    return {
        "status": "SUCCESS",
        "message": f"Facility {registered['name']} provisioned via Terraform IaC",
        "facility": registered,
    }

@app.get("/api/inventory/{item_id}", response_model=ItemOut)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@app.post("/api/inventory", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(payload: ItemCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(InventoryItem).where(InventoryItem.sku == payload.sku))
    if existing:
        raise HTTPException(status_code=400, detail=f"SKU '{payload.sku}' already exists")

    item = InventoryItem(**payload.model_dump())
    item.status = item.calculate_status()
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.put("/api/inventory/{item_id}", response_model=ItemOut)
def update_item(item_id: int, payload: ItemUpdate, db: Session = Depends(get_db)):
    item = db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    item.status = item.calculate_status()
    item.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return item

@app.post("/api/inventory/{item_id}/restock", response_model=ItemOut)
def restock_item(item_id: int, payload: RestockRequest, db: Session = Depends(get_db)):
    item = db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.quantity += payload.amount
    item.status = item.calculate_status()
    item.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return item

@app.post("/api/inventory/{item_id}/dispatch", response_model=ItemOut)
def dispatch_item(item_id: int, payload: DispatchRequest, db: Session = Depends(get_db)):
    """Dispatches/deducts stock for outbound order fulfillment. Validates against negative stock."""
    item = db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.quantity < payload.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient inventory: requested {payload.amount} units, but only {item.quantity} available in stock",
        )

    item.quantity -= payload.amount
    item.status = item.calculate_status()
    item.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return item

@app.delete("/api/inventory/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()

