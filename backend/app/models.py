from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base

class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sku: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), default="General", nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    min_threshold: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    warehouse_location: Mapped[str] = mapped_column(String(100), default="Aisle 1", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="IN_STOCK", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def calculate_status(self) -> str:
        if self.quantity <= 0:
            return "OUT_OF_STOCK"
        elif self.quantity <= self.min_threshold:
            return "LOW_STOCK"
        return "IN_STOCK"
