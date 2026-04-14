#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/mercari-study/current}"
ENV_FILE="${ENV_FILE:-/etc/mercari-study/mercari-study.env}"
WEB_SERVICE_NAME="${WEB_SERVICE_NAME:-mercari-study-web.service}"
DISCORD_BOT_SERVICE_NAME="${DISCORD_BOT_SERVICE_NAME:-mercari-study-discord-bot.service}"

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

if systemctl list-unit-files | grep -q "^${DISCORD_BOT_SERVICE_NAME}"; then
  sudo systemctl restart "$DISCORD_BOT_SERVICE_NAME"
fi

echo "Deploy completed."
