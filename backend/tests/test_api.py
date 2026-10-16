def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "UP"}

def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "LogiTrack API"

def test_create_inventory_item(client):
    payload = {
        "sku": "SKU-ELEC-001",
        "name": "Wireless Barcode Scanner",
        "category": "Electronics",
        "quantity": 25,
        "min_threshold": 5,
        "unit_price": 79.99,
        "warehouse_location": "Aisle 3, Bin B",
    }
    response = client.post("/api/inventory", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["sku"] == "SKU-ELEC-001"
    assert data["status"] == "IN_STOCK"
    assert data["id"] is not None

def test_create_duplicate_sku_fails(client):
    payload = {
        "sku": "SKU-HARD-001",
        "name": "Heavy Duty Pallet",
        "category": "Hardware",
        "quantity": 10,
        "min_threshold": 2,
        "unit_price": 45.00,
        "warehouse_location": "Zone A",
    }
    res1 = client.post("/api/inventory", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/inventory", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]

def test_restock_item(client):
    create_res = client.post(
        "/api/inventory",
        json={
            "sku": "SKU-LOG-001",
            "name": "Thermal Shipping Labels",
            "category": "Logistics",
            "quantity": 0,
            "min_threshold": 10,
            "unit_price": 12.50,
            "warehouse_location": "Aisle 1",
        },
    )
    assert create_res.status_code == 201
    item_id = create_res.json()["id"]
    assert create_res.json()["status"] == "OUT_OF_STOCK"

    # Restock with 15 units
    restock_res = client.post(f"/api/inventory/{item_id}/restock", json={"amount": 15})
    assert restock_res.status_code == 200
    updated = restock_res.json()
    assert updated["quantity"] == 15
    assert updated["status"] == "IN_STOCK"

def test_dispatch_item(client):
    create_res = client.post(
        "/api/inventory",
        json={
            "sku": "SKU-DISP-001",
            "name": "Barcode Scanner Battery",
            "category": "Electronics",
            "quantity": 20,
            "min_threshold": 10,
            "unit_price": 25.00,
            "warehouse_location": "Aisle 2",
        },
    )
    assert create_res.status_code == 201
    item_id = create_res.json()["id"]
    assert create_res.json()["status"] == "IN_STOCK"

    # 1. Dispatch 15 units -> drops to 5 (<= min_threshold 10) -> LOW_STOCK
    d1_res = client.post(f"/api/inventory/{item_id}/dispatch", json={"amount": 15})
    assert d1_res.status_code == 200
    assert d1_res.json()["quantity"] == 5
    assert d1_res.json()["status"] == "LOW_STOCK"

    # 2. Attempt to dispatch 10 units (more than 5 in stock) -> 400 Bad Request
    d_fail = client.post(f"/api/inventory/{item_id}/dispatch", json={"amount": 10})
    assert d_fail.status_code == 400
    assert "Insufficient inventory" in d_fail.json()["detail"]

    # 3. Dispatch remaining 5 units -> drops to 0 -> OUT_OF_STOCK
    d2_res = client.post(f"/api/inventory/{item_id}/dispatch", json={"amount": 5})
    assert d2_res.status_code == 200
    assert d2_res.json()["quantity"] == 0
    assert d2_res.json()["status"] == "OUT_OF_STOCK"

def test_get_and_filter_inventory(client):
    client.post(
        "/api/inventory",
        json={
            "sku": "SKU-A1",
            "name": "Forklift Battery",
            "category": "Hardware",
            "quantity": 2,
            "min_threshold": 5,
            "unit_price": 320.00,
            "warehouse_location": "Dock 2",
        },
    )
    client.post(
        "/api/inventory",
        json={
            "sku": "SKU-A2",
            "name": "Packing Tape Roll",
            "category": "Logistics",
            "quantity": 100,
            "min_threshold": 20,
            "unit_price": 3.50,
            "warehouse_location": "Aisle 5",
        },
    )

    all_items = client.get("/api/inventory").json()
    assert len(all_items) == 2

    hardware_items = client.get("/api/inventory?category=Hardware").json()
    assert len(hardware_items) == 1
    assert hardware_items[0]["sku"] == "SKU-A1"

def test_inventory_stats(client):
    client.post(
        "/api/inventory",
        json={
            "sku": "SKU-S1",
            "name": "Item In Stock",
            "category": "General",
            "quantity": 50,
            "min_threshold": 10,
            "unit_price": 10.0,
            "warehouse_location": "A1",
        },
    )
    client.post(
        "/api/inventory",
        json={
            "sku": "SKU-S2",
            "name": "Item Low Stock",
            "category": "General",
            "quantity": 5,
            "min_threshold": 10,
            "unit_price": 20.0,
            "warehouse_location": "A2",
        },
    )
    client.post(
        "/api/inventory",
        json={
            "sku": "SKU-S3",
            "name": "Item Out of Stock",
            "category": "General",
            "quantity": 0,
            "min_threshold": 5,
            "unit_price": 15.0,
            "warehouse_location": "A3",
        },
    )

    stats = client.get("/api/inventory/stats").json()
    assert stats["total_items"] == 3
    assert stats["in_stock"] == 1
    assert stats["low_stock"] == 1
    assert stats["out_of_stock"] == 1
    assert stats["total_valuation"] == (50 * 10.0) + (5 * 20.0) + (0 * 15.0)

def test_update_and_delete_item(client):
    res = client.post(
        "/api/inventory",
        json={
            "sku": "SKU-TEMP",
            "name": "Temporary Item",
            "category": "General",
            "quantity": 10,
            "min_threshold": 5,
            "unit_price": 5.0,
            "warehouse_location": "Aisle 9",
        },
    )
    item_id = res.json()["id"]

    # Update item
    update_res = client.put(f"/api/inventory/{item_id}", json={"name": "Updated Item Name", "quantity": 3})
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Updated Item Name"
    assert update_res.json()["status"] == "LOW_STOCK"

    # Delete item
    del_res = client.delete(f"/api/inventory/{item_id}")
    assert del_res.status_code == 204

    # Verify 404
    get_res = client.get(f"/api/inventory/{item_id}")
    assert get_res.status_code == 404

def test_facilities_discovery_and_provision_demo(client):
    # 1. Test listing discovered facilities
    res = client.get("/api/inventory/facilities")
    assert res.status_code == 200
    facilities = res.json()
    assert len(facilities) >= 3
    assert any("Mumbai" in f["name"] for f in facilities)
    assert any(f["status"] == "Operational" for f in facilities)

    # 2. Test provisioning a new facility via IaC demo
    demo_payload = {
        "id": "delhi-ncr-hub",
        "name": "Northern Hub — Delhi NCR D1",
        "region": "ap-south-2 (Northern AWS Region)",
        "location": "NH-48 Logistics Corridor, Gurgaon",
        "aisles": "Aisles 25–40",
        "storage_utilization": 35,
        "dispatch_sla": "99.7%",
        "provisioner": "Terraform AWS EKS Module v20.37.1",
    }
    prov_res = client.post("/api/inventory/facilities/provision-demo", json=demo_payload)
    assert prov_res.status_code == 201
    assert prov_res.json()["status"] == "SUCCESS"

    # 3. Verify the new facility appears dynamically in facilities list
    updated_res = client.get("/api/inventory/facilities")
    updated_facilities = updated_res.json()
    assert any(f["id"] == "delhi-ncr-hub" for f in updated_facilities)

