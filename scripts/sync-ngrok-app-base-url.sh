#!/bin/bash

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
NGROK_API_URL="${NGROK_API_URL:-http://127.0.0.1:4040/api/tunnels}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 が必要です。" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl が必要です。" >&2
  exit 1
fi

ngrok_response="$(curl -fsS "$NGROK_API_URL")"

public_url="$(python3 -c '
import json
import sys

data = json.loads(sys.argv[1])
for tunnel in data.get("tunnels", []):
    if tunnel.get("proto") == "https":
        print(tunnel["public_url"])
        break
else:
    raise SystemExit(1)
' "$ngrok_response")"

python3 - "$ENV_FILE" "$public_url" <<'PY'
from pathlib import Path
import sys

env_path = Path(sys.argv[1])
public_url = sys.argv[2]

lines = env_path.read_text().splitlines()
updated = []
replaced = False

for line in lines:
    if line.startswith("APP_BASE_URL="):
        updated.append(f'APP_BASE_URL="{public_url}"')
        replaced = True
    else:
        updated.append(line)

if not replaced:
    updated.append(f'APP_BASE_URL="{public_url}"')

env_path.write_text("\n".join(updated) + "\n")
PY

echo "APP_BASE_URL updated to $public_url"
