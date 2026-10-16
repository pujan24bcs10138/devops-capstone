#!/usr/bin/env python3
"""
LogiTrack Warehouse & Inventory Seeding Script.
Populates the database with realistic inventory items across multiple categories,
stock levels (IN_STOCK, LOW_STOCK, OUT_OF_STOCK), and warehouse locations.
"""

import sys
import httpx

API_BASE = "http://localhost:8000/api/inventory"

SAMPLE_ITEMS = [
    {
        "sku": "SKU-ELEC-101",
        "name": "Industrial Rugged Barcode Scanner",
        "category": "Electronics",
        "quantity": 48,
        "min_threshold": 10,
        "unit_price": 149.99,
        "warehouse_location": "Aisle 1, Rack B (Mumbai Hub)",
    },
    {
        "sku": "SKU-ELEC-102",
        "name": "Long-Range Zebra RFID Gate Reader",
        "category": "Electronics",
        "quantity": 4,
        "min_threshold": 8,
        "unit_price": 890.00,
        "warehouse_location": "Aisle 2, Bin C (Bangalore Hub)",
    },
    {
        "sku": "SKU-ELEC-103",
        "name": "Thermal Label Printer ZT411",
        "category": "Electronics",
        "quantity": 0,
        "min_threshold": 5,
        "unit_price": 620.00,
        "warehouse_location": "Aisle 2, Bin A (Mumbai Hub)",
    },
    {
        "sku": "SKU-HARD-201",
        "name": "Heavy Duty Steel Pallet Jack (2500kg)",
        "category": "Hardware",
        "quantity": 12,
        "min_threshold": 4,
        "unit_price": 380.00,
        "warehouse_location": "Dock 3, Zone A (Pune Overflow)",
    },
    {
        "sku": "SKU-HARD-202",
        "name": "Hydraulic Forklift Lift Cylinder",
        "category": "Hardware",
        "quantity": 2,
        "min_threshold": 5,
        "unit_price": 750.00,
        "warehouse_location": "Maintenance Bay (Mumbai Hub)",
    },
    {
        "sku": "SKU-HARD-203",
        "name": "Impact-Resistant Safety Helmets (Pack of 10)",
        "category": "Hardware",
        "quantity": 65,
        "min_threshold": 15,
        "unit_price": 45.00,
        "warehouse_location": "Aisle 9, Bin E (Bangalore Hub)",
    },
    {
        "sku": "SKU-LOG-301",
        "name": "Reinforced Brown Packing Tape (36 Rolls)",
        "category": "Logistics",
        "quantity": 150,
        "min_threshold": 30,
        "unit_price": 18.50,
        "warehouse_location": "Aisle 4, Shelving D (Mumbai Hub)",
    },
    {
        "sku": "SKU-LOG-302",
        "name": "Industrial Shrink Wrap Roll (500m)",
        "category": "Logistics",
        "quantity": 7,
        "min_threshold": 20,
        "unit_price": 28.00,
        "warehouse_location": "Aisle 4, Pallet 3 (Bangalore Hub)",
    },
    {
        "sku": "SKU-LOG-303",
        "name": "Direct Thermal Shipping Labels 4x6 (5000 qty)",
        "category": "Logistics",
        "quantity": 0,
        "min_threshold": 25,
        "unit_price": 34.99,
        "warehouse_location": "Aisle 5, Bin B (Mumbai Hub)",
    },
    {
        "sku": "SKU-GEN-401",
        "name": "Anti-Fatigue Warehouse Floor Mats (6ft)",
        "category": "General",
        "quantity": 35,
        "min_threshold": 10,
        "unit_price": 54.00,
        "warehouse_location": "Packing Station 1-4",
    },
    {
        "sku": "SKU-GEN-402",
        "name": "First Aid & Burn Treatment Kit (OSHA Compliant)",
        "category": "General",
        "quantity": 3,
        "min_threshold": 6,
        "unit_price": 85.00,
        "warehouse_location": "Supervisor Office A",
    },
    {
        "sku": "SKU-ELEC-104",
        "name": "IoT Environmental Temperature & Humidity Sensor",
        "category": "Electronics",
        "quantity": 28,
        "min_threshold": 8,
        "unit_price": 95.00,
        "warehouse_location": "Cold Storage Unit 1",
    },
]

def seed_inventory():
    print(f"Connecting to LogiTrack API at: {API_BASE}")
    client = httpx.Client(timeout=10.0)

    # Check backend health
    try:
        health = client.get("http://localhost:8000/health")
        if health.status_code != 200 or health.json().get("status") != "UP":
            print("Error: Backend is not reporting UP status.")
            sys.exit(1)
        print("Backend health check PASSED (UP).")
    except Exception as e:
        print(f"Connection failed: {e}")
        print("Make sure the backend is running (`docker compose up -d` or `uvicorn app.main:app`).")
        sys.exit(1)

    created_count = 0
    skipped_count = 0

    for item in SAMPLE_ITEMS:
        try:
            res = client.post(API_BASE, json=item)
            if res.status_code == 201:
                data = res.json()
                print(f"  [+] Created: {data['sku']} - {data['name']} (Status: {data['status']}, Qty: {data['quantity']})")
                created_count += 1
            elif res.status_code == 400 and "already exists" in res.text:
                print(f"  [*] Exists:  {item['sku']} - skipped duplicate")
                skipped_count += 1
            else:
                print(f"  [!] Failed:  {item['sku']} - HTTP {res.status_code}: {res.text}")
        except Exception as err:
            print(f"  [!] Error creating {item['sku']}: {err}")

    print("\n--- Seeding Summary ---")
    print(f"Successfully inserted: {created_count}")
    print(f"Skipped existing:      {skipped_count}")

    # Fetch updated statistics
    stats_res = client.get(f"{API_BASE}/stats")
    if stats_res.status_code == 200:
        stats = stats_res.json()
        print("\n--- Current Inventory Metrics ---")
        print(f"Total SKUs:       {stats['total_items']}")
        print(f"In Stock:         {stats['in_stock']}")
        print(f"Low Stock Alerts: {stats['low_stock']}")
        print(f"Out of Stock:     {stats['out_of_stock']}")
        print(f"Total Valuation:  ${stats['total_valuation']:,.2f}")

    print("\nSeeding complete! Refresh http://localhost:3000 to see all data.")

if __name__ == "__main__":
    seed_inventory()
