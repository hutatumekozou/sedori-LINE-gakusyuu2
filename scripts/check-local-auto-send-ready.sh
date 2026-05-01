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

echo "[$LOG_TS] dispatch-healthcheck-questions start"
echo "project_root=$PROJECT_ROOT"
echo "env_file=$ENV_FILE"

if curl -fsS http://127.0.0.1:3000 >/dev/null; then
  echo "local_web=ok"
else
  echo "local_web=unavailable"
fi

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

if [[ -n "${ngrok_url:-}" ]]; then
  echo "ngrok=ok"
  echo "ngrok_url=$ngrok_url"

  if "$PROJECT_ROOT/scripts/sync-ngrok-app-base-url.sh"; then
    echo "sync_ngrok_status=ok"
  else
    echo "sync_ngrok_status=failed"
  fi
else
  echo "ngrok=unavailable"
  echo "sync_ngrok_status=skipped"
fi

set +e
/usr/local/bin/node ./node_modules/tsx/dist/cli.mjs src/scripts/dispatch-healthcheck-questions.ts
exit_code=$?
set -e

echo "dispatch:healthcheck-questions exit_code=$exit_code"

if [[ "$exit_code" -ne 0 ]]; then
  notify_failure "11時動作確認問題の送信に失敗しました。ログを確認してください。"
fi

exit "$exit_code"
