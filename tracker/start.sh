#!/usr/bin/env bash
#
# FundTrack — one command to run the app and expose it on a
# public Cloudflare tunnel (https://<random>.trycloudflare.com).
#
# Usage:
#   TRACKER_PASSWORD="our-secret" ./start.sh
#
# Optional env:
#   PORT              local port (default 4000)
#   TRACKER_PASSWORD  shared family password (default "family" — CHANGE IT)
#   TRACKER_CURRENCY  currency symbol (default "$")
#   NO_TUNNEL=1       run locally only, skip the public tunnel
#
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-4000}"
export PORT
# Two roles. Distinct defaults so admin and family are genuinely separate.
export TRACKER_ADMIN_PASSWORD="${TRACKER_ADMIN_PASSWORD:-${TRACKER_PASSWORD:-admin}}"
export TRACKER_FAMILY_PASSWORD="${TRACKER_FAMILY_PASSWORD:-family}"
export TRACKER_CURRENCY="${TRACKER_CURRENCY:-$}"   # USD

# Persist a session secret so logins survive restarts.
SECRET_FILE="data/.secret"
mkdir -p data
if [ ! -f "$SECRET_FILE" ]; then
  (head -c32 /dev/urandom | od -An -tx1 | tr -d ' \n') > "$SECRET_FILE" 2>/dev/null || date +%s%N > "$SECRET_FILE"
fi
export TRACKER_SECRET="$(cat "$SECRET_FILE")"

cleanup() {
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "${TUNNEL_PID:-}" ] && kill "$TUNNEL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Free the port if a stale instance is still holding it, so we never crash-loop
# on EADDRINUSE (e.g. an old manual run left open in a terminal).
if command -v lsof >/dev/null 2>&1; then
  STALE="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
  if [ -n "$STALE" ]; then
    echo "Port $PORT was busy (pids: $STALE) — freeing it ..."
    echo "$STALE" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
fi

echo "Starting FundTrack on port $PORT ..."
node server.js &
SERVER_PID=$!
sleep 1

if [ "${NO_TUNNEL:-0}" = "1" ]; then
  echo ""
  echo "  Local only:       http://localhost:$PORT"
  echo "  Admin password:   $TRACKER_ADMIN_PASSWORD"
  echo "  Family password:  $TRACKER_FAMILY_PASSWORD"
  echo ""
  wait "$SERVER_PID"
  exit 0
fi

# --- ensure cloudflared is available -------------------------------------
if command -v cloudflared >/dev/null 2>&1; then
  CF="cloudflared"
elif [ -x ./cloudflared ]; then
  CF="./cloudflared"   # reuse a previously downloaded binary
else
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64|amd64) ARCH=amd64 ;;
    aarch64|arm64) ARCH=arm64 ;;
  esac
  BASE="https://github.com/cloudflare/cloudflared/releases/latest/download"
  CF="./cloudflared"

  if [ "$OS" = "darwin" ]; then
    # On macOS, prefer Homebrew; otherwise the release ships a .tgz, not a bare binary.
    if command -v brew >/dev/null 2>&1; then
      echo "Installing cloudflared via Homebrew ..."
      brew install cloudflared >/dev/null 2>&1 || true
    fi
    if command -v cloudflared >/dev/null 2>&1; then
      CF="cloudflared"
    else
      echo "Downloading cloudflared (macOS $ARCH) ..."
      TMP="$(mktemp -d)"
      if curl -fsSL -o "$TMP/cf.tgz" "$BASE/cloudflared-darwin-${ARCH}.tgz" \
         && tar -xzf "$TMP/cf.tgz" -C "$TMP"; then
        cp "$TMP/cloudflared" ./cloudflared && chmod +x ./cloudflared
      fi
    fi
  else
    echo "Downloading cloudflared ($OS $ARCH) ..."
    curl -fsSL -o ./cloudflared "$BASE/cloudflared-${OS}-${ARCH}" && chmod +x ./cloudflared
  fi

  if [ "$CF" = "./cloudflared" ] && [ ! -x ./cloudflared ]; then
    echo ""
    echo "  Couldn't install cloudflared automatically."
    echo "  On macOS run:  brew install cloudflared"
    echo "  Then re-run ./start.sh"
    echo ""
    echo "  The app is still running locally at http://localhost:$PORT"
    wait "$SERVER_PID"
    exit 1
  fi
fi

echo "Opening public Cloudflare tunnel ..."
TUNLOG="$(mktemp)"

announce() {
  echo "$1" > data/public-url.txt
  echo ""
  echo "============================================================"
  echo "  FundTrack is LIVE  (USD)"
  echo ""
  echo "  Public link:  $1"
  echo ""
  echo "  Admin:  sign in with the admin password (leave email box empty)."
  echo "  Family: sign in with the account you created for them."
  echo "============================================================"
}

# Supervise the tunnel: keep it alive across drops (each relaunch gets a new
# quick-tunnel URL, written to data/public-url.txt). If the app server itself
# dies, exit non-zero so the service manager (launchd) restarts everything.
# No --protocol override: cloudflared negotiates QUIC and falls back to http2,
# which is the most reliable combination on a normal home network.
while kill -0 "$SERVER_PID" 2>/dev/null; do
  : > "$TUNLOG"
  "$CF" tunnel --no-autoupdate --url "http://localhost:$PORT" >"$TUNLOG" 2>&1 &
  TUNNEL_PID=$!

  URL=""
  for i in $(seq 1 30); do
    URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNLOG" | head -1 || true)"
    [ -n "$URL" ] && break
    kill -0 "$TUNNEL_PID" 2>/dev/null || break
    sleep 1
  done

  if [ -n "$URL" ]; then
    announce "$URL"
  else
    echo "  Tunnel didn't come up. Recent output:"
    sed 's/^/    /' "$TUNLOG" | tail -n 6
    echo "  (A 403 here means the network blocks api.trycloudflare.com.)"
    echo "  App still running locally at http://localhost:$PORT"
  fi

  # Watch both; leave this inner loop (to relaunch the tunnel) when it drops.
  while kill -0 "$TUNNEL_PID" 2>/dev/null; do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      kill "$TUNNEL_PID" 2>/dev/null || true
      echo "App server exited — stopping so it can be restarted."
      exit 1
    fi
    sleep 5
  done

  echo "$(date '+%Y-%m-%d %H:%M:%S') tunnel dropped — relaunching in 3s ..."
  sleep 3
done

echo "App server exited."
exit 1
