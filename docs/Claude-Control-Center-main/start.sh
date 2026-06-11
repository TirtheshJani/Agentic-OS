#!/bin/bash
# Claude Control Center — start backend + open browser
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting Claude Control Center..."
echo "  Backend → http://localhost:5050"
echo "  (serves frontend from backend/dist in production)"
echo ""
echo "For development (with hot-reload):"
echo "  Terminal 1: cd backend && venv/bin/python run.py"
echo "  Terminal 2: cd frontend && npm run dev"
echo "  Open:       http://localhost:5173"
echo ""

cd "$SCRIPT_DIR/backend"
exec venv/bin/python run.py
