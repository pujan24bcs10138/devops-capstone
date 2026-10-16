# Session 21 — DevOps Final Capstone: LogiTrack (Python)

## 1. What We Are Building

**LogiTrack** is a production-grade, SaaS-style smart warehouse and inventory tracking platform designed to demonstrate modern cloud engineering and DevOps practices:

- **Frontend**: React + Vite single-page application with responsive glassmorphism UI, KPI cards, real-time stock alert badges, and interactive replenishment modals.
- **Backend**: Python 3.12+ FastAPI service with Pydantic v2 data validation and SQLAlchemy ORM.
- **Database**: PostgreSQL 16 relational database with Alembic schema migrations.
- **Testing**: Pytest automated test suite using isolated in-memory test database fixtures.
- **Containerization**: Secure, multi-stage Docker images running as non-root users (`appuser:10001` for backend, `nginxinc/nginx-unprivileged` for frontend).
- **Local Orchestration**: Docker Compose for single-command 3-tier stack startup.
- **CI/CD Automation**: GitHub Actions pipeline automating Pytest, Vite builds, Trivy container CVE scans, GHCR image publishing with Git SHA tags, and Helm releases.
- **Security**: DevSecOps gates using Aqua Security Trivy failing on HIGH and CRITICAL vulnerabilities.
- **Infrastructure as Code**: Terraform modules provisioning AWS VPC (public/private subnets, NAT Gateway) and Amazon EKS cluster v1.31 in `ap-south-1`.
- **Kubernetes & Helm**: Reusable Helm chart packaging Deployments (2+ replicas), ClusterIP Services, Nginx Ingress Controller routing, and Horizontal Pod Autoscaler (HPA).
- **Observability**: Prometheus FastAPI instrumentator exposing `/metrics` with ServiceMonitor targets and Grafana dashboards.
- **Diagnostics**: Built-in troubleshooting lab manifests simulating common Kubernetes failure modes.

```text
Developer Laptop
       │
       ▼
Git / GitHub (main branch)
       │
       ▼
GitHub Actions CI/CD
  ├── 1. Run Pytest suite & Build Frontend
  ├── 2. Build Docker images (tagged with Git commit SHA)
  ├── 3. Trivy Container Vulnerability Scan (HIGH/CRITICAL)
  └── 4. Push images to GHCR (ghcr.io)
               │
               ▼
       Terraform (IaC)
  ├── AWS VPC (CIDR 10.20.0.0/16, Public & Private subnets, NAT GW)
  └── Amazon EKS Cluster v1.31 (Managed Node Group: t3.medium)
               │
               ▼
           Helm Chart
               │
       ┌───────┴────────┐
       ▼                ▼
 Frontend (React)   Backend (FastAPI)
 (Port 8080/80)     (Port 8000)
       │                │
       │                ▼
       └──────────► PostgreSQL (Port 5432)
                        │
                        ▼
             Prometheus & Grafana
```

---

## 2. Repository Structure

```text
DevOpsCapstone/
├── .github/workflows/
│   └── ci-cd.yml             # 3-stage GitHub Actions CI/CD workflow
├── backend/
│   ├── alembic/              # Database migration scripts
│   │   └── versions/         # Migration versions (0001_create_inventory_items.py)
│   ├── app/
│   │   ├── config.py         # App configuration & settings
│   │   ├── db.py             # SQLAlchemy engine & session factory
│   │   ├── main.py           # FastAPI REST API & probes (/health, /ready, /metrics)
│   │   ├── models.py         # InventoryItem SQLAlchemy ORM model
│   │   └── schemas.py        # Pydantic v2 schemas
│   ├── tests/
│   │   └── test_api.py       # 8 comprehensive Pytest test cases
│   ├── conftest.py           # Pytest test DB fixtures
│   ├── Dockerfile            # Non-root Python 3.12 container
│   ├── pytest.ini            # Pytest configuration
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── main.jsx          # React dashboard with KPI cards & modals
│   │   └── styles.css        # Responsive dark-slate CSS design system
│   ├── index.html            # Entry HTML with Inter typography
│   ├── nginx.conf            # Non-root reverse proxy configuration
│   ├── Dockerfile            # Multi-stage non-root build
│   ├── package.json          # Vite 5 + React 18 configuration
│   └── vite.config.js        # Vite dev server & proxy
├── docker-compose.yml        # Full 3-container local stack
├── terraform/
│   ├── main.tf               # AWS VPC + EKS cluster definitions
│   ├── variables.tf          # Configurable variables
│   ├── outputs.tf            # Cluster endpoint & VPC ID outputs
│   ├── versions.tf           # AWS provider & Terraform version constraints
│   └── terraform.tfvars.example # Safe template without committed secrets
├── helm/logitrack/           # Complete Helm chart
│   ├── Chart.yaml            # Chart metadata
│   ├── values.yaml           # Default values
│   ├── values-dev.yaml       # Development override values
│   ├── values-prod.yaml      # Production override values
│   └── templates/
│       ├── _helpers.tpl      # Naming helpers
│       ├── backend-deployment.yaml
│       ├── backend-service.yaml
│       ├── frontend-deployment.yaml
│       ├── frontend-service.yaml
│       ├── ingress.yaml      # Path routing (/ -> frontend, /api -> backend)
│       ├── postgres.yaml     # PVC, Secret, Service & Deployment
│       ├── hpa.yaml          # Horizontal Pod Autoscaler
│       └── servicemonitor.yaml # Prometheus Operator scraping spec
├── k8s/
│   └── namespace.yaml        # 'logitrack' namespace manifest
├── monitoring/
│   └── prometheus-values.yaml # Helm values for kube-prometheus-stack
├── scripts/
│   └── load-test.sh          # Traffic load simulator to test HPA
├── troubleshooting/
│   ├── broken-image.yaml     # ImagePullBackOff diagnostic lab
│   └── broken-service.yaml   # Label selector mismatch diagnostic lab
└── GRADING.md                # 100-point rubric breakdown
```

---

## 3. Backend REST APIs & Health Endpoints

FastAPI exposes the following endpoints:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Service metadata, version, and documentation link |
| `GET` | `/health` | Cheap liveness check returning `{"status": "UP"}` |
| `GET` | `/ready` | Readiness check verifying database connectivity returning `{"status": "READY"}` |
| `GET` | `/metrics` | Prometheus-formatted metrics collected by `prometheus-fastapi-instrumentator` |
| `GET` | `/api/inventory` | List all inventory items with optional `category` and `status` query filters |
| `GET` | `/api/inventory/stats` | Aggregated metrics: total SKUs, in-stock, low-stock alerts, out-of-stock, and total inventory valuation |
| `GET` | `/api/inventory/{id}` | Retrieve specific item by ID (404 if missing) |
| `POST` | `/api/inventory` | Create new inventory item (201 Created), validates uniqueness of SKU |
| `PUT` | `/api/inventory/{id}` | Update existing item metadata, auto-recalculating status |
| `POST` | `/api/inventory/{id}/restock` | Replenish inventory quantity and update stock status |
| `DELETE` | `/api/inventory/{id}` | Remove inventory item (204 No Content) |

Interactive Swagger documentation is available at `/docs` when running.

---

## 4. Running Locally

### Option A: Fastest Method with Docker Compose

Requirements:
- Docker Desktop or Docker Engine

Start the entire stack (PostgreSQL, Backend, Frontend):
```bash
docker compose up --build
```

Access the services:
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **FastAPI Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Liveness Probe**: [http://localhost:8000/health](http://localhost:8000/health)
- **Prometheus Metrics**: [http://localhost:8000/metrics](http://localhost:8000/metrics)

Stop the stack:
```bash
docker compose down
```

To wipe the persistent database volume as well:
```bash
docker compose down -v
```

---

### Option B: Running the Backend Locally

```bash
cd backend
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

---

### Option C: Running the Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

---

## 5. Automated Testing (Pytest)

The test suite covers endpoints using isolated in-memory SQLite fixtures (`backend/conftest.py`):

```bash
cd backend
pytest -v
```

All 8 tests execute and pass:
1. `test_health`: Verifies `/health` returns `{"status": "UP"}`
2. `test_root`: Verifies `/` returns API metadata
3. `test_create_inventory_item`: Tests item creation with automatic status calculation
4. `test_create_duplicate_sku_fails`: Asserts 400 Bad Request on duplicate SKU
5. `test_restock_item`: Verifies quantity incrementation and status transition
6. `test_get_and_filter_inventory`: Tests listing and category query filters
7. `test_inventory_stats`: Verifies inventory valuation and stock bucket aggregation
8. `test_update_and_delete_item`: Tests full update, deletion, and 404 responses

---

## 6. Docker Container Architecture

Both Dockerfiles follow security best practices:

- **Backend Dockerfile** (`backend/Dockerfile`):
  - Base: `python:3.12-slim`
  - Creates dedicated unprivileged user `appuser` (UID 10001)
  - Drops root privileges via `USER 10001`
  - Runs database migrations before starting Uvicorn

- **Frontend Dockerfile** (`frontend/Dockerfile`):
  - Multi-stage build: Stage 1 builds static React assets with Node 22; Stage 2 serves assets with `nginxinc/nginx-unprivileged:alpine`
  - Runs unprivileged as `USER 101`
  - Listens on non-root port `8080`

---

## 7. CI/CD & DevSecOps Pipeline

The GitHub Actions workflow (`.github/workflows/ci-cd.yml`) triggers on every push to `main`:

1. **Test Job**: Runs `pytest -v` and executes `npm run build`
2. **Build-Scan-Push Job**:
   - Builds backend and frontend Docker images tagged with the commit SHA (`${{ github.sha }}`)
   - Scans both images with **Aqua Security Trivy**, failing if any `HIGH` or `CRITICAL` vulnerabilities are detected
   - Authenticates to GHCR and publishes the images
3. **Deploy Job**:
   - Configures `kubectl` credentials from secrets
   - Executes `helm upgrade --install` to deploy the application into the `logitrack` namespace

---

## 8. Terraform Infrastructure (AWS)

Located in `terraform/`:
- **VPC Module**: Creates `logitrack-vpc` in `ap-south-1` (`10.20.0.0/16`) with 2 public subnets, 2 private subnets, and a NAT Gateway.
- **EKS Module**: Creates `logitrack-eks` (Kubernetes v1.31) with a managed node group of 2–4 `t3.medium` worker instances.
- **Variables & Example**: `terraform.tfvars.example` provides a safe template without hardcoded credentials.

To provision:
```bash
cd terraform
terraform init
terraform plan
terraform apply
```

To clean up and avoid cloud costs:
```bash
terraform destroy
```

---

## 9. Kubernetes & Helm Deployment

Deploy to your Kubernetes cluster:

```bash
# 1. Create namespace
kubectl apply -f k8s/namespace.yaml

# 2. Deploy with Helm
helm upgrade --install logitrack ./helm/logitrack \
  --namespace logitrack \
  --create-namespace
```

Verify deployment:
```bash
kubectl get pods -n logitrack
kubectl get svc -n logitrack
kubectl get ingress -n logitrack
kubectl get hpa -n logitrack
```

---

## 10. Horizontal Pod Autoscaling (HPA) & Load Testing

The backend Deployment is governed by an HPA resource configured to scale between 2 and 6 replicas at 60% CPU utilization.

To generate synthetic load:
```bash
chmod +x scripts/load-test.sh
./scripts/load-test.sh
```

Monitor scaling in real-time:
```bash
kubectl get hpa -n logitrack -w
```

---

## 11. Troubleshooting Exercises

Two diagnostic exercises are provided in `troubleshooting/`:

1. **Broken Image (`troubleshooting/broken-image.yaml`)**:
   - Simulates `ImagePullBackOff` by referencing a non-existent container tag.
   - Diagnosis: `kubectl describe pod <pod-name> -n logitrack` $\rightarrow$ inspect Events for 404/Manifest unknown.

2. **Broken Service (`troubleshooting/broken-service.yaml`)**:
   - Simulates zero-endpoint connectivity by using an invalid label selector.
   - Diagnosis: `kubectl get endpoints -n logitrack` shows `<none>` $\rightarrow$ match service selector with pod labels.
