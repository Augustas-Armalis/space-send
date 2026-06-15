#!/bin/bash
# Stop the Space Send dev server (frees port 3000). Double-click to run.
cd "$(dirname "$0")" || exit 1

echo ""
echo "  Stopping Space Send…"

pids="$(lsof -ti tcp:3000 2>/dev/null)"
if [ -n "$pids" ]; then
  kill $pids 2>/dev/null
  sleep 1
  # Force-kill anything still holding the port
  pids="$(lsof -ti tcp:3000 2>/dev/null)"
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null
  echo "  Stopped."
else
  # Fall back to any stray Next dev process
  pkill -f "next dev" 2>/dev/null && echo "  Stopped." || echo "  Nothing was running."
fi

echo ""
echo "  This window can be closed."
sleep 1
