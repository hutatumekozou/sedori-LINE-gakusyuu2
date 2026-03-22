#!/bin/bash

set -euo pipefail

HOUR="${1:-13}"
MINUTE="${2:-0}"
SOURCE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_ROOT="${RUNTIME_ROOT:-$HOME/mercari-study-line-runtime}"
RUNNER_PATH="${RUNNER_PATH:-/Users/kukkiiboy/bin/mercari-study-send-due.sh}"
PLIST_PATH="${PLIST_PATH:-/Users/kukkiiboy/Library/LaunchAgents/com.kukkiiboy.mercari-study.send-due.plist}"
LOG_OUT="${LOG_OUT:-/Users/kukkiiboy/Library/Logs/mercari-study-send-due.log}"
LOG_ERR="${LOG_ERR:-/Users/kukkiiboy/Library/Logs/mercari-study-send-due.error.log}"

mkdir -p /Users/kukkiiboy/bin /Users/kukkiiboy/Library/LaunchAgents /Users/kukkiiboy/Library/Logs
"$SOURCE_ROOT/scripts/sync-local-runtime.sh"

cat > "$RUNNER_PATH" <<SH
#!/bin/bash
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$RUNTIME_ROOT"
export PROJECT_ROOT="$RUNTIME_ROOT"
export ENV_FILE="$RUNTIME_ROOT/.env"
exec ./scripts/run-send-due-local.sh
SH
chmod +x "$RUNNER_PATH"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.kukkiiboy.mercari-study.send-due</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$RUNNER_PATH</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$RUNTIME_ROOT</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>$HOUR</integer>
    <key>Minute</key>
    <integer>$MINUTE</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$LOG_OUT</string>
  <key>StandardErrorPath</key>
  <string>$LOG_ERR</string>
</dict>
</plist>
PLIST

JOB_DOMAIN="gui/$(id -u)"
JOB_LABEL="com.kukkiiboy.mercari-study.send-due"

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl remove "$JOB_LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "$JOB_DOMAIN" "$PLIST_PATH"
launchctl enable "$JOB_DOMAIN/$JOB_LABEL"

echo "Installed launchd job at ${HOUR}:${MINUTE}"
echo "plist: $PLIST_PATH"
echo "source_root: $SOURCE_ROOT"
echo "runtime_root: $RUNTIME_ROOT"
echo "runner_path: $RUNNER_PATH"
launchctl print "$JOB_DOMAIN/$JOB_LABEL" | sed -n '1,80p'
