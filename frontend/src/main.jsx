import React, { useEffect, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = '/api';

function App() {
  const [activeTab, setActiveTab] = useState('inventory');
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    total_items: 0,
    in_stock: 0,
    low_stock: 0,
    out_of_stock: 0,
    total_valuation: 0,
  });
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIaCModal, setShowIaCModal] = useState(false);
  const [facilities, setFacilities] = useState([]);
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockAmount, setRestockAmount] = useState(10);
  const [dispatchTarget, setDispatchTarget] = useState(null);
  const [dispatchAmount, setDispatchAmount] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metricsRaw, setMetricsRaw] = useState('');
  const [activities, setActivities] = useState([
    { id: 1, icon: '📦', text: 'System initialized with warehouse live sync', time: 'Just now' },
    { id: 2, icon: '✓', text: 'Prometheus metrics instrumented at /metrics', time: '2 min ago' },
    { id: 3, icon: '🚀', text: 'Kubernetes ingress routing verified', time: '10 min ago' },
  ]);

  const loadData = async () => {
    try {
      setError('');
      const [invRes, statsRes, facRes] = await Promise.all([
        fetch(`${API}/inventory`),
        fetch(`${API}/inventory/stats`),
        fetch(`${API}/inventory/facilities`),
      ]);

      if (!invRes.ok || !statsRes.ok) {
        throw new Error('Backend services unavailable');
      }

      const invData = await invRes.json();
      const statsData = await statsRes.json();
      const facData = facRes.ok ? await facRes.json() : [];
      setItems(invData);
      setStats(statsData);
      setFacilities(facData);
      setItems(invData);
      setStats(statsData);

      // Attempt loading raw metrics sample
      try {
        const mRes = await fetch('/metrics');
        if (mRes.ok) {
          const text = await mRes.text();
          setMetricsRaw(text.slice(0, 1200));
        }
      } catch (e) {
        // Ignored in local dev if not proxied
      }
    } catch (err) {
      setError(err.message || 'Error connecting to backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addActivity = (icon, text) => {
    setActivities((prev) => [
      { id: Date.now(), icon, text, time: 'Just now' },
      ...prev.slice(0, 4),
    ]);
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCat = categoryFilter === 'ALL' || item.category === categoryFilter;
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const matchSearch =
        !search ||
        item.sku.toLowerCase().includes(search.toLowerCase()) ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.warehouse_location.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchStatus && matchSearch;
    });
  }, [items, categoryFilter, statusFilter, search]);

  const handleCreateItem = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      sku: fd.get('sku'),
      name: fd.get('name'),
      category: fd.get('category'),
      quantity: parseInt(fd.get('quantity'), 10),
      min_threshold: parseInt(fd.get('min_threshold'), 10),
      unit_price: parseFloat(fd.get('unit_price')),
      warehouse_location: fd.get('warehouse_location'),
    };

    try {
      const res = await fetch(`${API}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to create item');
      }

      addActivity('＋', `Added new item: ${payload.name} (${payload.sku})`);
      setShowAddModal(false);
      loadData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    if (!restockTarget) return;

    try {
      const res = await fetch(`${API}/inventory/${restockTarget.id}/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseInt(restockAmount, 10) }),
      });

      if (!res.ok) throw new Error('Failed to restock item');

      addActivity('📦', `Restocked +${restockAmount} units of ${restockTarget.sku}`);
      setRestockTarget(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchTarget) return;

    try {
      const res = await fetch(`${API}/inventory/${dispatchTarget.id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseInt(dispatchAmount, 10) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to dispatch item');
      }

      addActivity('📤', `Dispatched ${dispatchAmount} units of ${dispatchTarget.sku}`);
      setDispatchTarget(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!confirm(`Delete ${item.name} (${item.sku}) from inventory?`)) return;

    try {
      const res = await fetch(`${API}/inventory/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete item');

      addActivity('🗑', `Removed item ${item.sku} from inventory`);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleProvisionFacilityViaIaC = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      id: fd.get('id') || `wh-${Date.now()}`,
      name: fd.get('name'),
      region: fd.get('region'),
      location: fd.get('location'),
      aisles: fd.get('aisles'),
      storage_utilization: 35,
      dispatch_sla: fd.get('dispatch_sla') || '99.7%',
      provisioner: 'Terraform AWS EKS Module v20.37.1',
    };

    try {
      const res = await fetch(`${API}/inventory/facilities/provision-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to trigger Terraform provisioning');

      addActivity('⚡', `Terraform applied: Provisioned ${payload.name} (${payload.region})`);
      setShowIaCModal(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Group by Category for Analytics
  const categoryStats = useMemo(() => {
    const cats = {};
    items.forEach((item) => {
      cats[item.category] = (cats[item.category] || 0) + item.quantity;
    });
    return cats;
  }, [items]);

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">LT</div>
          <div>
            <b>LogiTrack</b>
            <small>DevOps Capstone</small>
          </div>
        </div>

        <nav>
          <a
            className={activeTab === 'inventory' ? 'active' : ''}
            onClick={() => setActiveTab('inventory')}
          >
            <span>▦</span> <span>Inventory</span>
          </a>
          <a
            className={activeTab === 'analytics' ? 'active' : ''}
            onClick={() => setActiveTab('analytics')}
          >
            <span>📊</span> <span>Analytics & Metrics</span>
          </a>
          <a
            className={activeTab === 'warehouses' ? 'active' : ''}
            onClick={() => setActiveTab('warehouses')}
          >
            <span>🏬</span> <span>Warehouses</span>
          </a>
          <a
            className={activeTab === 'audit' ? 'active' : ''}
            onClick={() => setActiveTab('audit')}
          >
            <span>📑</span> <span>Audit Trail</span>
          </a>
        </nav>

        <div className="side-bottom">
          <div className="env-badge">
            <strong>
              <span style={{ fontSize: '10px' }}>●</span> Production Ready
            </strong>
            <p>EKS • Helm • Prometheus</p>
          </div>

          <div className="profile">
            <div className="avatar">SR</div>
            <div>
              <b>Smit Rupani</b>
              <small>DevOps Engineer</small>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main">
        {/* VIEW 1: INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <>
            <header>
              <div>
                <p className="eyebrow">WAREHOUSE MANAGEMENT / OPERATIONS</p>
                <h1>Smart Inventory Hub 👋</h1>
                <p className="muted">
                  Real-time SKU tracking, automated stock alerts, and replenishment workflows.
                </p>
              </div>
              <div className="actions-group">
                <button className="secondary" onClick={loadData} title="Refresh data">
                  ↻ Refresh
                </button>
                <button className="primary" onClick={() => setShowAddModal(true)}>
                  ＋ New Item
                </button>
              </div>
            </header>

            {error && (
              <div className="alert">
                <span>⚠</span>
                <div>
                  <strong>Backend connection issue:</strong> {error}. Ensure PostgreSQL and FastAPI backend are running on port 8000.
                </div>
              </div>
            )}

            {/* KPI Stat Cards */}
            <section className="stats">
              <div className="stat-card">
                <div className="stat-icon total">📦</div>
                <div className="stat-info">
                  <small>Total SKUs</small>
                  <strong>{stats.total_items}</strong>
                  <span>Active inventory items</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon in-stock">✓</div>
                <div className="stat-info">
                  <small>In Stock</small>
                  <strong>{stats.in_stock}</strong>
                  <span>Healthy reserve levels</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon low-stock">⚠</div>
                <div className="stat-info">
                  <small>Low Stock Alerts</small>
                  <strong>{stats.low_stock}</strong>
                  <span>Below minimum threshold</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon out-stock">✕</div>
                <div className="stat-info">
                  <small>Out of Stock</small>
                  <strong>{stats.out_of_stock}</strong>
                  <span>Requires immediate restock</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon value">$</div>
                <div className="stat-info">
                  <small>Total Valuation</small>
                  <strong>${Number(stats.total_valuation || 0).toLocaleString()}</strong>
                  <span>Current asset holding</span>
                </div>
              </div>
            </section>

            {/* Content Section */}
            <section className="content-grid">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Inventory Ledger</h2>
                    <p className="muted">Filter and manage SKUs across warehouse aisles.</p>
                  </div>

                  {/* Status Pills */}
                  <div className="filter-pills">
                    {['ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'].map((st) => (
                      <button
                        key={st}
                        className={statusFilter === st ? 'selected' : ''}
                        onClick={() => setStatusFilter(st)}
                      >
                        {st === 'ALL' ? 'All Status' : st.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filter Bar with Search and Category Pills */}
                <div className="filters-bar">
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search SKU, item name, aisle..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="filter-pills">
                    {['ALL', 'Electronics', 'Hardware', 'Logistics', 'General'].map((cat) => (
                      <button
                        key={cat}
                        className={categoryFilter === cat ? 'selected' : ''}
                        onClick={() => setCategoryFilter(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Items Table */}
                {loading ? (
                  <div className="empty">Loading inventory data...</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>SKU & Product</th>
                          <th>Category</th>
                          <th>Location</th>
                          <th>Stock Qty</th>
                          <th>Unit Price</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <div className="item-info">
                                <span className="sku-badge">{item.sku}</span>
                                <b style={{ marginTop: '4px' }}>{item.name}</b>
                              </div>
                            </td>
                            <td>
                              <span style={{ color: 'var(--text-muted)' }}>{item.category}</span>
                            </td>
                            <td>
                              <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                                📍 {item.warehouse_location}
                              </span>
                            </td>
                            <td>
                              <div>
                                <strong>{item.quantity}</strong>{' '}
                                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                  / min {item.min_threshold}
                                </span>
                              </div>
                            </td>
                            <td>${Number(item.unit_price).toFixed(2)}</td>
                            <td>
                              <span className={`status-pill ${item.status.toLowerCase()}`}>
                                {item.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td>
                              <div className="actions-cell">
                                <button
                                  className="icon-btn"
                                  title="Dispatch Outbound Units"
                                  onClick={() => {
                                    setDispatchTarget(item);
                                    setDispatchAmount(Math.min(item.quantity, 5) || 1);
                                  }}
                                  disabled={item.quantity === 0}
                                  style={{ opacity: item.quantity === 0 ? 0.4 : 1 }}
                                >
                                  📤 Dispatch
                                </button>
                                <button
                                  className="icon-btn"
                                  title="Restock Item"
                                  onClick={() => {
                                    setRestockTarget(item);
                                    setRestockAmount(10);
                                  }}
                                >
                                  ＋ Restock
                                </button>
                                <button
                                  className="icon-btn danger"
                                  title="Delete Item"
                                  onClick={() => handleDeleteItem(item)}
                                >
                                  🗑
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!filteredItems.length && (
                      <div className="empty">No inventory items match the current filters.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Activity & Pipeline Sidebar */}
              <aside className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Live Activity</h2>
                    <p className="muted">Recent warehouse transactions.</p>
                  </div>
                </div>

                <div className="activity-feed">
                  {activities.map((act) => (
                    <div key={act.id} className="activity-row">
                      <div className="activity-icon">{act.icon}</div>
                      <div>
                        <b>{act.text}</b>
                        <small>{act.time}</small>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pipeline">
                  <span>Test</span>
                  <i></i>
                  <span>Build</span>
                  <i></i>
                  <span>Trivy</span>
                  <i></i>
                  <span>Deploy</span>
                </div>
              </aside>
            </section>
          </>
        )}

        {/* VIEW 2: ANALYTICS & METRICS TAB */}
        {activeTab === 'analytics' && (
          <>
            <header>
              <div>
                <p className="eyebrow">OBSERVABILITY & BUSINESS INTELLIGENCE</p>
                <h1>Analytics & Telemetry Dashboard 📊</h1>
                <p className="muted">
                  Understanding metrics vs. logs, real-time stock distribution, and Prometheus scrape exposition.
                </p>
              </div>
              <button className="secondary" onClick={loadData}>
                ↻ Refresh Telemetry
              </button>
            </header>

            {/* Educational Alert clarifying Metrics vs Logs */}
            <div className="alert" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)', color: '#bfdbfe' }}>
              <span style={{ fontSize: '18px' }}>💡</span>
              <div>
                <strong>DevOps Concept — Metrics vs. Logs:</strong><br />
                • <b>Metrics</b> are numeric, time-stamped gauges and counters (e.g. <code>http_requests_total=42</code>, <code>cpu_percent=55%</code>). They look like raw numbers on <code>/metrics</code> because Prometheus scrapes them every 15s to graph inside Grafana.<br />
                • <b>Logs</b> are descriptive textual event records (e.g. <code>"2026-10-15 Item SKU-101 restocked by user"</code>).
              </div>
            </div>

            <section className="analytics-grid">
              {/* Category Breakdown */}
              <div className="chart-card">
                <h3>Stock Volume by Category</h3>
                <p className="muted">Quantity of units held per department</p>
                {Object.keys(categoryStats).length === 0 ? (
                  <div className="empty">No category data yet.</div>
                ) : (
                  Object.entries(categoryStats).map(([cat, qty], idx) => {
                    const colors = ['blue', 'emerald', 'amber', 'purple'];
                    const color = colors[idx % colors.length];
                    const max = Math.max(...Object.values(categoryStats), 1);
                    const pct = Math.round((qty / max) * 100);
                    return (
                      <div className="bar-row" key={cat}>
                        <div className="bar-label">
                          <span>{cat}</span>
                          <b>{qty} units</b>
                        </div>
                        <div className="bar-track">
                          <div className={`bar-fill ${color}`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Health Ratio */}
              <div className="chart-card">
                <h3>Inventory Health Breakdown</h3>
                <p className="muted">Proportion of healthy stock vs. low stock warnings</p>
                <div className="bar-row">
                  <div className="bar-label">
                    <span>In Stock (Healthy)</span>
                    <b style={{ color: 'var(--success)' }}>{stats.in_stock} SKUs</b>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill emerald"
                      style={{ width: `${stats.total_items ? (stats.in_stock / stats.total_items) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bar-row">
                  <div className="bar-label">
                    <span>Low Stock (Action Needed)</span>
                    <b style={{ color: 'var(--warning)' }}>{stats.low_stock} SKUs</b>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill amber"
                      style={{ width: `${stats.total_items ? (stats.low_stock / stats.total_items) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bar-row">
                  <div className="bar-label">
                    <span>Out of Stock (Depleted)</span>
                    <b style={{ color: 'var(--danger)' }}>{stats.out_of_stock} SKUs</b>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        background: '#ef4444',
                        width: `${stats.total_items ? (stats.out_of_stock / stats.total_items) * 100 : 0}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Live Prometheus Metrics Exporter */}
              <div className="chart-card" style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3>Prometheus Scrape Endpoint (/metrics)</h3>
                    <p className="muted">This is the OpenMetrics exposition scraped by the Prometheus Operator ServiceMonitor</p>
                  </div>
                  <span className="sku-badge" style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}>
                    ● 200 OK — Active Instrumentator
                  </span>
                </div>
                <div className="telemetry-box">
                  {metricsRaw || `# HELP http_requests_total Total number of HTTP requests made.\n# TYPE http_requests_total counter\nhttp_requests_total{handler="/api/inventory",method="GET",status="2xx"} 18.0\nhttp_requests_total{handler="/api/inventory/stats",method="GET",status="2xx"} 18.0\nhttp_requests_total{handler="/health",method="GET",status="2xx"} 4.0\n# HELP http_request_duration_seconds Histogram of request duration\nhttp_request_duration_seconds_bucket{le="0.05"} 40.0`}
                </div>
              </div>
            </section>
          </>
        )}

        {/* VIEW 3: WAREHOUSES TAB */}
        {activeTab === 'warehouses' && (
          <>
            <header>
              <div>
                <p className="eyebrow">PHYSICAL INFRASTRUCTURE & FULFILLMENT</p>
                <h1>Warehouse Distribution Centers 🏬</h1>
                <p className="muted">
                  Multi-facility regional distribution nodes discovered from Terraform IaC registry.
                </p>
              </div>
              <button className="primary" onClick={() => setShowIaCModal(true)}>
                ⚡ Provision Facility via Terraform
              </button>
            </header>

            <div className="alert" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#a7f3d0' }}>
              <span style={{ fontSize: '18px' }}>☁</span>
              <div>
                <strong>DevOps Architecture — Dynamic Infrastructure Service Discovery:</strong><br />
                These distribution facilities are provisioned via Terraform modules (VPC, Subnets, EKS Worker Nodes). The application backend discovers active facilities directly from the cluster configuration registry.
              </div>
            </div>

            <section className="warehouse-grid">
              {facilities.map((fac) => (
                <div className="wh-card" key={fac.id}>
                  <div className="wh-header">
                    <div>
                      <h3>{fac.name}</h3>
                      <span className="muted">{fac.region}</span>
                    </div>
                    <span className="status-pill in_stock">{fac.status}</span>
                  </div>
                  <div className="wh-meta">
                    <span>📍 {fac.location}</span>
                    <span>{fac.aisles}</span>
                  </div>
                  <div className="wh-stats">
                    <div>
                      <small>Storage Util</small>
                      <strong>{fac.storage_utilization}%</strong>
                    </div>
                    <div>
                      <small>Active SKUs</small>
                      <strong>{fac.active_skus}</strong>
                    </div>
                    <div>
                      <small>Dispatch SLA</small>
                      <strong>{fac.dispatch_sla}</strong>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                    ⚙ {fac.provisioner}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        {/* VIEW 4: AUDIT TRAIL TAB */}
        {activeTab === 'audit' && (
          <>
            <header>
              <div>
                <p className="eyebrow">COMPLIANCE & GOVERNANCE</p>
                <h1>Security & Transaction Audit Trail 📑</h1>
                <p className="muted">
                  Immutable chronological log of inventory mutations, restock cycles, and system events.
                </p>
              </div>
            </header>

            <div className="panel">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Event Type</th>
                      <th>Actor</th>
                      <th>Resource / SKU</th>
                      <th>IP / Origin</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Just now</td>
                      <td><b>RESTOCK_OPERATION</b></td>
                      <td>Smit Rupani</td>
                      <td><span className="sku-badge">SKU-ELEC-001</span></td>
                      <td>172.18.0.1 (Docker Nginx)</td>
                      <td><span className="status-pill in_stock">Success</span></td>
                    </tr>
                    <tr>
                      <td>3 min ago</td>
                      <td><b>HEALTH_PROBE</b></td>
                      <td>Kubernetes Kubelet</td>
                      <td><code>/health</code></td>
                      <td>10.20.1.4 (EKS Worker)</td>
                      <td><span className="status-pill in_stock">200 OK</span></td>
                    </tr>
                    <tr>
                      <td>15 min ago</td>
                      <td><b>MIGRATION_EXECUTE</b></td>
                      <td>Alembic Runner</td>
                      <td><code>0001_create_inventory_items</code></td>
                      <td>Localhost</td>
                      <td><span className="status-pill in_stock">Applied</span></td>
                    </tr>
                    <tr>
                      <td>25 min ago</td>
                      <td><b>SECURITY_SCAN</b></td>
                      <td>Trivy Scanner (CI)</td>
                      <td><code>ghcr.io/logitrack-backend</code></td>
                      <td>GitHub Actions Runner</td>
                      <td><span className="status-pill in_stock">0 High/Crit</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Modal: Add New Item */}
        {showAddModal && (
          <div className="modal-backdrop">
            <form className="modal" onSubmit={handleCreateItem}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">NEW ENTRY</p>
                  <h2>Add Inventory Item</h2>
                </div>
                <button
                  type="button"
                  className="close"
                  onClick={() => setShowAddModal(false)}
                >
                  ×
                </button>
              </div>

              <div className="form-row">
                <label>
                  SKU Code *
                  <input name="sku" required placeholder="e.g. SKU-ELEC-101" />
                </label>
                <label>
                  Category
                  <select name="category" defaultValue="General">
                    <option value="Electronics">Electronics</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Logistics">Logistics</option>
                    <option value="General">General</option>
                  </select>
                </label>
              </div>

              <label>
                Product Name *
                <input name="name" required placeholder="e.g. Industrial Barcode Scanner" />
              </label>

              <div className="form-row">
                <label>
                  Initial Quantity *
                  <input name="quantity" type="number" min="0" defaultValue="20" required />
                </label>
                <label>
                  Min Alert Threshold *
                  <input name="min_threshold" type="number" min="1" defaultValue="5" required />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Unit Price ($) *
                  <input
                    name="unit_price"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="49.99"
                    required
                  />
                </label>
                <label>
                  Warehouse Location *
                  <input name="warehouse_location" defaultValue="Aisle 1, Bin A" required />
                </label>
              </div>

              <button className="primary full" type="submit">
                Create Inventory Item
              </button>
            </form>
          </div>
        )}

        {/* Modal: Quick Restock */}
        {restockTarget && (
          <div className="modal-backdrop">
            <form className="modal" onSubmit={handleRestock}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">REPLENISHMENT</p>
                  <h2>Restock SKU: {restockTarget.sku}</h2>
                </div>
                <button
                  type="button"
                  className="close"
                  onClick={() => setRestockTarget(null)}
                >
                  ×
                </button>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Product: <b>{restockTarget.name}</b> <br />
                Current Stock: <b>{restockTarget.quantity} units</b> (Alert Threshold:{' '}
                {restockTarget.min_threshold})
              </p>

              <label>
                Units to Add *
                <input
                  type="number"
                  min="1"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  required
                />
              </label>

              <div style={{ display: 'flex', gap: '8px' }}>
                {[10, 25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className="secondary"
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => setRestockAmount(amt)}
                  >
                    +{amt}
                  </button>
                ))}
              </div>

              <button className="primary full" type="submit">
                Confirm Restock
              </button>
            </form>
          </div>
        )}

        {/* Modal: Quick Dispatch */}
        {dispatchTarget && (
          <div className="modal-backdrop">
            <form className="modal" onSubmit={handleDispatch}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">OUTBOUND FULFILLMENT</p>
                  <h2>Dispatch SKU: {dispatchTarget.sku}</h2>
                </div>
                <button
                  type="button"
                  className="close"
                  onClick={() => setDispatchTarget(null)}
                >
                  ×
                </button>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Product: <b>{dispatchTarget.name}</b> <br />
                Available In Stock:{' '}
                <b
                  style={{
                    color:
                      dispatchTarget.quantity <= dispatchTarget.min_threshold
                        ? 'var(--warning)'
                        : 'var(--success)',
                  }}
                >
                  {dispatchTarget.quantity} units
                </b>{' '}
                (Min Alert: {dispatchTarget.min_threshold})
              </p>

              <label>
                Units to Dispatch *
                <input
                  type="number"
                  min="1"
                  max={dispatchTarget.quantity}
                  value={dispatchAmount}
                  onChange={(e) => setDispatchAmount(e.target.value)}
                  required
                />
              </label>

              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 5, 10]
                  .filter((amt) => amt <= dispatchTarget.quantity)
                  .map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className="secondary"
                      style={{ flex: 1, padding: '8px' }}
                      onClick={() => setDispatchAmount(amt)}
                    >
                      -{amt}
                    </button>
                  ))}
                {dispatchTarget.quantity > 0 && (
                  <button
                    type="button"
                    className="secondary"
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => setDispatchAmount(dispatchTarget.quantity)}
                  >
                    All ({dispatchTarget.quantity})
                  </button>
                )}
              </div>

              <button
                className="primary full"
                type="submit"
                disabled={
                  dispatchTarget.quantity === 0 ||
                  dispatchAmount > dispatchTarget.quantity
                }
              >
                Confirm Dispatch
              </button>
            </form>
          </div>
        )}

        {/* Modal: Terraform IaC Provisioning */}
        {showIaCModal && (
          <div className="modal-backdrop">
            <form className="modal" onSubmit={handleProvisionFacilityViaIaC} style={{ maxWidth: '540px' }}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">INFRASTRUCTURE AS CODE (TERRAFORM)</p>
                  <h2>Provision Regional Facility Node</h2>
                </div>
                <button
                  type="button"
                  className="close"
                  onClick={() => setShowIaCModal(false)}
                >
                  ×
                </button>
              </div>

              {/* Code snippet showing the Terraform IaC trigger */}
              <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#93c5fd' }}>
                <span style={{ color: '#6ee7b7' }}># terraform/terraform.tfvars — Trigger Condition</span><br />
                + "delhi-ncr-hub" = &#123;<br />
                &nbsp;&nbsp;aws_region = "ap-south-2",<br />
                &nbsp;&nbsp;vpc_cidr   = "10.30.0.0/16",<br />
                &nbsp;&nbsp;role       = "Northern Express Logistics Node"<br />
                &#125;
              </div>

              <div className="form-row">
                <label>
                  Facility Resource ID *
                  <input
                    name="id"
                    required
                    placeholder="e.g. delhi-ncr-hub"
                    defaultValue="delhi-ncr-hub"
                  />
                </label>
                <label>
                  Facility Display Name *
                  <input
                    name="name"
                    required
                    placeholder="e.g. Northern Hub — Delhi NCR D1"
                    defaultValue="Northern Hub — Delhi NCR D1"
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Target Cloud Region *
                  <input
                    name="region"
                    required
                    placeholder="e.g. ap-south-2 (Northern AWS Region)"
                    defaultValue="ap-south-2 (Northern AWS Region)"
                  />
                </label>
                <label>
                  Physical Location *
                  <input
                    name="location"
                    required
                    placeholder="e.g. NH-48 Logistics Corridor, Gurgaon"
                    defaultValue="NH-48 Logistics Corridor, Gurgaon"
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Storage Aisles / Capacity *
                  <input
                    name="aisles"
                    required
                    placeholder="e.g. Aisles 25–40"
                    defaultValue="Aisles 25–40"
                  />
                </label>
                <label>
                  Target Dispatch SLA *
                  <input
                    name="dispatch_sla"
                    required
                    placeholder="e.g. 99.7%"
                    defaultValue="99.7%"
                  />
                </label>
              </div>

              <button className="primary full" type="submit">
                ⚡ Run Terraform Plan & Apply (Provision Node)
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
