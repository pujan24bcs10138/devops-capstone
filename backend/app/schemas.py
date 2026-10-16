from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

ItemStatus = Literal["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]

class ItemCreate(BaseModel):
    sku: str = Field(min_length=2, max_length=60, description="Unique SKU code")
    name: str = Field(min_length=1, max_length=200, description="Item product name")
    category: str = Field(default="General", max_length=100)
    quantity: int = Field(default=0, ge=0, description="Available stock quantity")
    min_threshold: int = Field(default=10, ge=1, description="Low-stock alert threshold")
    unit_price: float = Field(default=0.0, ge=0.0, description="Unit price in USD")
    warehouse_location: str = Field(default="Aisle 1", max_length=100)

class ItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = None
    quantity: int | None = Field(default=None, ge=0)
    min_threshold: int | None = Field(default=None, ge=1)
    unit_price: float | None = Field(default=None, ge=0.0)
    warehouse_location: str | None = None
    status: ItemStatus | None = None

class RestockRequest(BaseModel):
    amount: int = Field(gt=0, description="Quantity to add to current inventory stock")

class DispatchRequest(BaseModel):
    amount: int = Field(gt=0, description="Quantity to dispatch/deduct from current inventory stock")
    destination: str | None = Field(default=None, description="Optional destination or order reference")


class ItemOut(BaseModel):
    id: int
    sku: str
    name: str
    category: str
    quantity: int
    min_threshold: int
    unit_price: float
    warehouse_location: str
    status: ItemStatus
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class InventoryStatsOut(BaseModel):
    total_items: int
    in_stock: int
    low_stock: int
    out_of_stock: int
    total_valuation: float
