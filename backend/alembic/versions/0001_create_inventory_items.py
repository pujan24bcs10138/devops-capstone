from alembic import op
import sqlalchemy as sa

revision = "0001_create_inventory_items"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "inventory_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sku", sa.String(length=60), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False, server_default="General"),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("min_threshold", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("unit_price", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("warehouse_location", sa.String(length=100), nullable=False, server_default="Aisle 1"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="IN_STOCK"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f("ix_inventory_items_sku"), "inventory_items", ["sku"], unique=True)

def downgrade():
    op.drop_index(op.f("ix_inventory_items_sku"), table_name="inventory_items")
    op.drop_table("inventory_items")
