#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Hybrid MediaWorks — Auto Job Agent startup script
# Kills any stale processes on ports 8000 / 5173, then starts both servers.
# Usage:  ./start.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "  ██╗  ██╗██╗   ██╗██████╗ ██████╗ ██╗██████╗"
echo "  ██║  ██║╚██╗ ██╔╝██╔══██╗██╔══██╗██║██╔══██╗"
echo "  ███████║ ╚████╔╝ ██████╔╝██████╔╝██║██║  ██║"
echo "  ██╔══██║  ╚██╔╝  ██╔══██╗██╔══██╗██║██║  ██║"
echo "  ██║  ██║   ██║   ██████╔╝██║  ██║██║██████╔╝"
echo "  ╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚═╝  ╚═╝╚═╝╚═════╝"
echo "        MediaWorks — Auto Job Agent"
echo ""

# ── Kill anything on ports 8000 / 5173 ───────────────────────────────────────
echo "→ Clearing ports 8000 and 5173..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 1

# ── Activate Python virtual environment ──────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/venv/bin/activate" ]; then
  echo "✗ venv not found. Run:  python3 -m venv venv && pip install -r backend/requirements-web.txt"
  exit 1
fi
source "$SCRIPT_DIR/venv/bin/activate"

# ── Start Backend ─────────────────────────────────────────────────────────────
echo "→ Starting backend on http://localhost:8000 ..."
uvicorn app.main:app --reload --app-dir "$SCRIPT_DIR/backend" --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Wait until backend is responsive (max 10s)
echo -n "  Waiting for backend"
for i in $(seq 1 20); do
  if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo " ✓"
    break
  fi
  echo -n "."
  sleep 0.5
done

# ── Start Frontend ────────────────────────────────────────────────────────────
echo "→ Starting frontend on http://localhost:5173 ..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  ✅ Backend  → http://localhost:8000"
echo "  ✅ Frontend → http://localhost:5173"
echo "  📄 API docs → http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

# ── Trap Ctrl+C and kill both servers cleanly ─────────────────────────────────
trap "echo ''; echo '→ Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
