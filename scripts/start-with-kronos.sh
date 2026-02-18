#!/bin/bash
set -euo pipefail

PRD_FILE="${1:-}"

if [ -z "$PRD_FILE" ]; then
  echo "Usage: ./scripts/start-with-kronos.sh <prd-file>"
  echo "Example: ./scripts/start-with-kronos.sh .nova/prd-test.json"
  exit 1
fi

# Check if Kronos server is running on port 8765
if curl -s --max-time 2 http://localhost:8765/health > /dev/null 2>&1; then
  echo "[Kronos] Server detected on port 8765"
  echo "[Kronos] Memory ingest will be active for this run"
else
  echo "[Kronos] Server not detected on port 8765"
  echo "[Kronos] Start Kronos first: cd ../Kronos && python src/mcp_server.py"
  echo "[Kronos] Continuing without Kronos (graceful degradation)"
  echo ""
fi

npx tsx src/index.ts run "$PRD_FILE"
