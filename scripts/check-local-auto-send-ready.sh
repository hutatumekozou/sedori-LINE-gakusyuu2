#!/bin/bash

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
LOG_TS="$(date '+%Y-%m-%d %H:%M:%S %Z %z')"

notify_failure() {
  local message="$1"

  if command -v osascript >/dev/null 2>&1; then
    osascript -e "display notification \"$message\" with title \"mercari-study 自動送信チェック\"" >/dev/null 2>&1 || true
  fi
}

echo "[$LOG_TS] check-local-auto-send-ready start"
echo "project_root=$PROJECT_ROOT"
echo "env_file=$ENV_FILE"

if ! curl -fsS http://127.0.0.1:3000 >/dev/null; then
  echo "local_web=failed"
  notify_failure "localhost:3000 に接続できません。npm run dev を確認してください。"
  exit 1
fi
echo "local_web=ok"

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

if [[ -z "${ngrok_url:-}" ]]; then
  echo "ngrok=failed"
  notify_failure "ngrok の HTTPS URL が取得できません。ngrok http 3000 を確認してください。"
  exit 1
fi
echo "ngrok=ok"
echo "ngrok_url=$ngrok_url"

if "$PROJECT_ROOT/scripts/sync-ngrok-app-base-url.sh"; then
  echo "sync_ngrok_status=ok"
else
  echo "sync_ngrok_status=failed"
  notify_failure "APP_BASE_URL の更新に失敗しました。"
  exit 1
fi

set +e
/usr/local/bin/node ./node_modules/tsx/dist/cli.mjs src/scripts/check-send-due-readiness.ts
exit_code=$?
set -e

echo "check:send-ready exit_code=$exit_code"

if [[ "$exit_code" -ne 0 ]]; then
  notify_failure "12時送信の事前チェックに失敗しました。ログを確認してください。"
fi

exit "$exit_code"
