#!/usr/bin/env bash
#
# Expose FundTrack on a PERMANENT, reliable public URL using Tailscale Funnel.
# Unlike the free Cloudflare quick tunnel, this URL never changes and survives
# reboots.
#
# One-time prerequisites (do these first):
#   1. Install Tailscale:  https://tailscale.com/download   (or: brew install --cask tailscale)
#   2. Open the Tailscale app and SIGN IN (free account).
#
# Then run:
#   TRACKER_ADMIN_PASSWORD="your-admin-pw" \
#   TRACKER_FAMILY_PASSWORD="your-family-pw" \
#   ./tailscale-setup.sh
#
set -uo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-4000}"

# --- locate the tailscale CLI ---------------------------------------------
TS="$(command -v tailscale 2>/dev/null || true)"
if [ -z "$TS" ] && [ -x "/Applications/Tailscale.app/Contents/MacOS/Tailscale" ]; then
  TS="/Applications/Tailscale.app/Contents/MacOS/Tailscale"
fi
if [ -z "$TS" ]; then
  echo "❌ Tailscale isn't installed."
  echo "   Install it from https://tailscale.com/download (or: brew install --cask tailscale),"
  echo "   open the app, sign in, then re-run this script."
  exit 1
fi

# --- make sure we're logged in --------------------------------------------
if ! "$TS" status >/dev/null 2>&1; then
  echo "❌ Tailscale is installed but not signed in."
  echo "   Open the Tailscale app, sign in (free account), then re-run this script."
  exit 1
fi

# --- find this machine's permanent Tailscale hostname ----------------------
HOST="$("$TS" status --json 2>/dev/null | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log((JSON.parse(d).Self.DNSName||"").replace(/\.$/,""))}catch(e){}})')"
if [ -z "$HOST" ]; then
  echo "❌ Couldn't read your Tailscale hostname. Is the app running and signed in?"
  exit 1
fi

# --- run the app persistently (no cloudflared; Tailscale handles exposure) --
echo "Installing FundTrack to run in the background (app only) ..."
NO_TUNNEL=1 \
TRACKER_ADMIN_PASSWORD="${TRACKER_ADMIN_PASSWORD:-${TRACKER_PASSWORD:-admin}}" \
TRACKER_FAMILY_PASSWORD="${TRACKER_FAMILY_PASSWORD:-family}" \
PORT="$PORT" \
bash install-autostart.sh >/dev/null
sleep 3

# --- turn on Tailscale Funnel ---------------------------------------------
echo "Enabling Tailscale Funnel on port $PORT ..."
FUNNEL_OUT="$("$TS" funnel --bg "$PORT" 2>&1 || true)"
echo "$FUNNEL_OUT" | grep -qi "funnel" && true

# If Funnel isn't enabled for the tailnet yet, Tailscale prints a consent URL.
if echo "$FUNNEL_OUT" | grep -qiE "enable|not allowed|https://login"; then
  echo ""
  echo "⚠️  One more one-time step — Tailscale needs Funnel enabled for your account:"
  echo "$FUNNEL_OUT" | sed 's/^/    /'
  echo ""
  echo "   Open the link above, click to enable Funnel, then re-run this script."
  exit 1
fi

URL="https://$HOST"
echo "$URL" > data/public-url.txt

echo ""
echo "============================================================"
echo "  ✅ FundTrack is LIVE on a PERMANENT link (USD)"
echo ""
echo "  ADMIN  link:  $URL/admin"
echo "  FAMILY link:  $URL/"
echo ""
echo "  This URL never changes and survives reboots."
echo "  Share the FAMILY link with the household; keep /admin for yourself."
echo "============================================================"
echo ""
echo "  To stop exposing it:  $TS funnel --https=443 off"
