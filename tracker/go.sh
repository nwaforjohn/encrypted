#!/usr/bin/env bash
#
# One-command clean rebuild + run.
#
# Stops EVERYTHING (autostart service + any stray server/tunnel), frees the
# port, pulls the latest code, then starts ONE fresh instance in the foreground
# and prints the public link. Keep this terminal window open while in use.
#
# Usage:
#   TRACKER_ADMIN_PASSWORD="your-admin-pw" ./go.sh
#
set -uo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-4000}"
BRANCH="claude/vibrant-carson-ww11ag"
PLIST="$HOME/Library/LaunchAgents/com.familymoney.tracker.plist"

echo "① Stopping any existing tracker (autostart + stray processes) ..."
launchctl unload "$PLIST" 2>/dev/null || true   # stop the dueling autostart service
pkill -f cloudflared       2>/dev/null || true
pkill -f "server.js"       2>/dev/null || true
pkill -f "start.sh"        2>/dev/null || true
# free the port no matter what is holding it
if command -v lsof >/dev/null 2>&1; then
  lsof -ti tcp:"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
fi
sleep 1

echo "② Updating to the latest version ..."
git fetch origin "$BRANCH" >/dev/null 2>&1 || true
git reset --hard "origin/$BRANCH" >/dev/null 2>&1 || true   # keeps data/ (git-ignored)

echo "③ Starting one fresh instance ..."
echo ""
exec bash start.sh
