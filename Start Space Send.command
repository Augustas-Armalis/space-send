#!/bin/bash
# ============================================================================
#  Start Space Send  —  double-click this file in Finder.
#  It finds Node automatically (even if your terminal can't), installs deps
#  the first time, starts the app, and opens it in your browser.
# ============================================================================

# Always run from the folder this file lives in.
cd "$(dirname "$0")" || exit 1

GREEN=$'\033[38;5;48m'; CYAN=$'\033[38;5;45m'; DIM=$'\033[2m'; RESET=$'\033[0m'
echo ""
echo "${CYAN}  ◍  Space Send${RESET}  ${DIM}— Transmit anything. Instantly.${RESET}"
echo ""

# --- Make Node/npm reachable even when launched from Finder (no nvm in PATH) ---
find_node() {
  command -v npm >/dev/null 2>&1 && return 0
  # 1) Source nvm if present
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
  command -v npm >/dev/null 2>&1 && return 0
  # 2) Use the newest installed nvm Node directly
  local latest
  latest="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$latest" ] && export PATH="$latest:$PATH"
  # 3) Homebrew / system locations
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  command -v npm >/dev/null 2>&1
}

if ! find_node; then
  echo "  Couldn't find Node.js. Install it once from ${CYAN}https://nodejs.org${RESET}"
  echo "  then double-click this file again."
  echo ""
  echo "  Press any key to close…"; read -n 1 -s; exit 1
fi

echo "  ${DIM}Node $(node -v) · npm $(npm -v)${RESET}"

# --- Install dependencies the first time only ---
if [ ! -d node_modules ]; then
  echo "  Installing dependencies (first run only — this can take a minute)…"
  npm install || { echo "  Install failed."; read -n 1 -s; exit 1; }
fi

# --- If it's already running, just open it ---
if lsof -ti tcp:3000 >/dev/null 2>&1; then
  echo "  Already running — opening your browser."
  open "http://localhost:3000"
  echo ""
  echo "  ${DIM}(This window can be closed.)${RESET}"
  exit 0
fi

# --- Self-heal: a leftover production build (.next/BUILD_ID) breaks `dev` and
#     serves unstyled pages. Clear it so dev rebuilds clean. ---
if [ -f .next/BUILD_ID ]; then
  echo "  Clearing a stale build cache…"
  rm -rf .next
fi

# --- Open the browser a few seconds after the server boots ---
( for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    if lsof -ti tcp:3000 >/dev/null 2>&1; then open "http://localhost:3000"; break; fi
  done ) &

echo ""
echo "  ${GREEN}▸ Launching at http://localhost:3000${RESET}"
echo "  ${DIM}Keep this window open while you use the app. Press Ctrl+C (or run${RESET}"
echo "  ${DIM}\"Stop Space Send\") to shut it down.${RESET}"
echo ""

exec npm run dev
