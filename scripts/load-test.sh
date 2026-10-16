#!/usr/bin/env bash
set -euo pipefail

URL="${URL:-http://logitrack.local/api/health}"
echo "Starting load test against $URL..."

for i in $(seq 1 500); do
  curl -s "$URL" >/dev/null || true
done

echo "Load test completed (500 requests dispatched)."
