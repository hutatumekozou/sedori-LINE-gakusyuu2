#!/bin/bash

set -euo pipefail

HOUR="${1:-13}"
MINUTE="${2:-0}"
PREFLIGHT_HOUR="${PREFLIGHT_HOUR:-11}"
PREFLIGHT_MINUTE="${PREFLIGHT_MINUTE:-55}"
SOURCE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_ROOT="${RUNTIME_ROOT:-$HOME/mercari-study-line-runtime}"
RUNNER_PATH="${RUNNER_PATH:-/Users/kukkiiboy/bin/mercari-study-send-due.sh}"
PLIST_PATH="${PLIST_PATH:-/Users/kukkiiboy/Library/LaunchAgents/com.kukkiiboy.mercari-study.send-due.plist}"
LOG_OUT="${LOG_OUT:-/Users/kukkiiboy/Library/Logs/mercari-study-send-due.log}"
LOG_ERR="${LOG_ERR:-/Users/kukkiiboy/Library/Logs/mercari-study-send-due.error.log}"
PREFLIGHT_RUNNER_PATH="${PREFLIGHT_RUNNER_PATH:-/Users/kukkiiboy/bin/mercari-study-send-due-preflight.sh}"
PREFLIGHT_PLIST_PATH="${PREFLIGHT_PLIST_PATH:-/Users/kukkiiboy/Library/LaunchAgents/com.kukkiiboy.mercari-study.send-due-preflight.plist}"
PREFLIGHT_LOG_OUT="${PREFLIGHT_LOG_OUT:-/Users/kukkiiboy/Library/Logs/mercari-study-send-due-preflight.log}"
PREFLIGHT_LOG_ERR="${PREFLIGHT_LOG_ERR:-/Users/kukkiiboy/Library/Logs/mercari-study-send-due-preflight.error.log}"

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

cat > "$PREFLIGHT_RUNNER_PATH" <<SH
#!/bin/bash
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$RUNTIME_ROOT"
export PROJECT_ROOT="$RUNTIME_ROOT"
export ENV_FILE="$RUNTIME_ROOT/.env"
exec ./scripts/check-local-auto-send-ready.sh
SH
chmod +x "$PREFLIGHT_RUNNER_PATH"

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

cat > "$PREFLIGHT_PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.kukkiiboy.mercari-study.send-due-preflight</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$PREFLIGHT_RUNNER_PATH</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$RUNTIME_ROOT</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>$PREFLIGHT_HOUR</integer>
    <key>Minute</key>
    <integer>$PREFLIGHT_MINUTE</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$PREFLIGHT_LOG_OUT</string>
  <key>StandardErrorPath</key>
  <string>$PREFLIGHT_LOG_ERR</string>
</dict>
</plist>
PLIST

JOB_DOMAIN="gui/$(id -u)"
JOB_LABEL="com.kukkiiboy.mercari-study.send-due"
PREFLIGHT_JOB_LABEL="com.kukkiiboy.mercari-study.send-due-preflight"

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl remove "$JOB_LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "$JOB_DOMAIN" "$PLIST_PATH"
launchctl enable "$JOB_DOMAIN/$JOB_LABEL"

launchctl bootout "gui/$(id -u)" "$PREFLIGHT_PLIST_PATH" >/dev/null 2>&1 || true
launchctl unload "$PREFLIGHT_PLIST_PATH" >/dev/null 2>&1 || true
launchctl remove "$PREFLIGHT_JOB_LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "$JOB_DOMAIN" "$PREFLIGHT_PLIST_PATH"
launchctl enable "$JOB_DOMAIN/$PREFLIGHT_JOB_LABEL"

echo "Installed launchd job at ${HOUR}:${MINUTE}"
echo "plist: $PLIST_PATH"
echo "source_root: $SOURCE_ROOT"
echo "runtime_root: $RUNTIME_ROOT"
echo "runner_path: $RUNNER_PATH"
echo "Installed preflight job at ${PREFLIGHT_HOUR}:${PREFLIGHT_MINUTE}"
echo "preflight_plist: $PREFLIGHT_PLIST_PATH"
echo "preflight_runner_path: $PREFLIGHT_RUNNER_PATH"
launchctl print "$JOB_DOMAIN/$JOB_LABEL" | sed -n '1,80p'
launchctl print "$JOB_DOMAIN/$PREFLIGHT_JOB_LABEL" | sed -n '1,80p'
