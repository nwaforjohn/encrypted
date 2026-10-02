#!/usr/bin/env bash
#
# Install FundTrack as a macOS login item (launchd LaunchAgent).
# After this, the app + Cloudflare tunnel start automatically when you log in,
# and restart themselves if they ever crash.
#
# Usage:
#   TRACKER_ADMIN_PASSWORD="admin-secret" \
#   TRACKER_FAMILY_PASSWORD="family-secret" \
#   ./install-autostart.sh
#
# To see the current public link at any time:
#   cat "<this folder>/data/public-url.txt"
#
# To remove autostart later:
#   ./install-autostart.sh --uninstall
#
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.fundtrack.tracker"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
OLD_PLIST="$HOME/Library/LaunchAgents/com.familymoney.tracker.plist"  # pre-rebrand

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This installer is for macOS. On Linux, use a systemd user service or just run ./start.sh."
  exit 1
fi

# Always clear out the old-named service so the two never run at once.
launchctl unload "$OLD_PLIST" 2>/dev/null || true
rm -f "$OLD_PLIST"

# --- uninstall -------------------------------------------------------------
if [ "${1:-}" = "--uninstall" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Autostart removed. (The app will no longer start at login.)"
  exit 0
fi

ADMIN="${TRACKER_ADMIN_PASSWORD:-${TRACKER_PASSWORD:-admin}}"
FAMILY="${TRACKER_FAMILY_PASSWORD:-family}"
PORT="${PORT:-4000}"
NO_TUNNEL="${NO_TUNNEL:-0}"   # 1 = run the app only (no cloudflared); used with Tailscale

# Make sure launchd can find node and cloudflared (Homebrew paths included).
RUN_PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$HOME/Library/LaunchAgents" "$DIR/data"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$DIR/start.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$RUN_PATH</string>
    <key>PORT</key>
    <string>$PORT</string>
    <key>NO_TUNNEL</key>
    <string>$NO_TUNNEL</string>
    <key>TRACKER_ADMIN_PASSWORD</key>
    <string>$ADMIN</string>
    <key>TRACKER_FAMILY_PASSWORD</key>
    <string>$FAMILY</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$DIR/data/autostart.log</string>
  <key>StandardErrorPath</key>
  <string>$DIR/data/autostart.log</string>
</dict>
</plist>
PLISTEOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load -w "$PLIST"

echo ""
echo "✅ Installed. The tracker now starts automatically when you log in."
echo ""
echo "   Admin password:   $ADMIN"
echo "   Family password:  $FAMILY"
echo ""
echo "   Finding your public link (wait ~20s after login, then):"
echo "     cat \"$DIR/data/public-url.txt\""
echo ""
echo "   Logs:      $DIR/data/autostart.log"
echo "   Uninstall: ./install-autostart.sh --uninstall"
echo ""
echo "   Note: the free trycloudflare link changes each time it restarts."
echo "   Check public-url.txt for the current one, or ask me to set up a"
echo "   permanent named-tunnel link."
