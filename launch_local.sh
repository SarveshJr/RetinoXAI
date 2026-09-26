#!/usr/bin/env bash
# RetinoXAI - 1-Click Launcher (SIH26038)
# Team HACK PROCESSING UNIT (SIH26-A0H-T316)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/prototype/frontend"
BACKEND_DIR="$SCRIPT_DIR/prototype/backend"

echo "========================================================"
echo "  RetinoXAI - Explainable AI for DR Screening"
echo "  Smart India Hackathon 2026 - Problem SIH26038"
echo "========================================================"
echo ""

# Ensure frontend is built
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "[*] Installing frontend dependencies..."
    cd "$FRONTEND_DIR" && npm install
fi

if [ ! -f "$FRONTEND_DIR/dist/index.html" ]; then
    echo "[*] Building frontend production bundle..."
    cd "$FRONTEND_DIR" && npm run build
fi

echo "Select launch mode:"
echo "[1] Standalone Web App (No MATLAB needed - Instant Demo Mode)"
echo "[2] Live MATLAB Engine + Unified Web App (Port 8080)"
echo "[3] Developer Mode (Vite Dev Server on Port 5173)"
echo ""
read -p "Enter choice (1, 2, or 3) [Default 1]: " MODE
MODE=${MODE:-1}

if [ "$MODE" = "1" ]; then
    echo "[*] Starting Standalone Web App on http://localhost:4173..."
    cd "$FRONTEND_DIR" && npx vite preview --port 4173 --open
elif [ "$MODE" = "2" ]; then
    if ! command -v matlab &> /dev/null; then
        echo "[!] 'matlab' command not found in PATH."
        echo "Starting standalone preview instead..."
        cd "$FRONTEND_DIR" && npx vite preview --port 4173 --open
    else
        echo "[*] Starting RetinoXAI MATLAB Server on http://localhost:8080..."
        matlab -batch "cd('$BACKEND_DIR'); RetinoXAIServer(8080)"
    fi
elif [ "$MODE" = "3" ]; then
    echo "[*] Starting Vite Dev Server on http://localhost:5173..."
    cd "$FRONTEND_DIR" && npm run dev -- --open
fi
