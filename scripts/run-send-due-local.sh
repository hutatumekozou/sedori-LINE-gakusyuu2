#!/bin/bash

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
LOG_TS="$(date '+%Y-%m-%d %H:%M:%S %Z %z')"
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
RUNNER_PATH="$(cd "$(dirname "$0")" && pwd)/run-send-due-local.sh"

ngrok_url="$(
  curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c '
import json
import sys
raw = sys.stdin.read().strip()
if not raw:
    print("")
    raise SystemExit(0)
data = json.loads(raw)
for tunnel in data.get("tunnels", []):
    if tunnel.get("proto") == "https":
        print(tunnel["public_url"])
        break
' || true
)"

echo "[$LOG_TS] run-send-due-local start"
echo "script_path=$SCRIPT_PATH"
echo "runner_path=$RUNNER_PATH"
echo "project_root=$PROJECT_ROOT"
echo "pwd_before=$PWD"
echo "env_file=$ENV_FILE"
echo "ngrok_url=${ngrok_url:-<unavailable>}"
echo "sync_ngrok_script=$PROJECT_ROOT/scripts/sync-ngrok-app-base-url.sh"

if "$PROJECT_ROOT/scripts/sync-ngrok-app-base-url.sh"; then
  echo "sync_ngrok_status=ok"
else
  sync_status=$?
  echo "sync_ngrok_status=failed($sync_status)"
  exit "$sync_status"
fi

cd "$PROJECT_ROOT"
echo "pwd_after=$PWD"
echo "app_base_url=$(grep '^APP_BASE_URL=' "$ENV_FILE" | cut -d= -f2-)"
echo "node_path=$(/usr/bin/which node || true)"
echo "tsx_path=$PROJECT_ROOT/node_modules/tsx/dist/cli.mjs"
echo "starting send:due"

set +e
/usr/local/bin/node ./node_modules/tsx/dist/cli.mjs src/scripts/send-due-items.ts
exit_code=$?
set -e

echo "send:due exit_code=$exit_code"
exit "$exit_code"
