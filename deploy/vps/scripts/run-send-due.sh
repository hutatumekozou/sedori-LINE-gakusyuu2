#!/usr/bin/env bash

set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

APP_ROOT="${APP_ROOT:-/opt/mercari-study/current}"
ENV_FILE="${ENV_FILE:-/etc/mercari-study/mercari-study.env}"

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

cd "$APP_ROOT"

exec /usr/bin/env node ./node_modules/tsx/dist/cli.mjs src/scripts/send-due-items.ts
