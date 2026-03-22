#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/mercari-study/current}"
ENV_FILE="${ENV_FILE:-/etc/mercari-study/mercari-study.env}"
WEB_SERVICE_NAME="${WEB_SERVICE_NAME:-mercari-study-web.service}"

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

cd "$APP_ROOT"

npm ci
npm run db:generate
npm run build
npm run db:push

sudo systemctl restart "$WEB_SERVICE_NAME"

echo "Deploy completed."
