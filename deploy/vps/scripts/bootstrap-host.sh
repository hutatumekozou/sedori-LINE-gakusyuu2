#!/usr/bin/env bash

set -euo pipefail

APP_USER="${APP_USER:-mercari-study}"
APP_GROUP="${APP_GROUP:-$APP_USER}"
APP_ROOT="${APP_ROOT:-/opt/mercari-study/current}"
APP_ETC_DIR="${APP_ETC_DIR:-/etc/mercari-study}"
APP_DATA_DIR="${APP_DATA_DIR:-/var/lib/mercari-study}"
APP_LOG_DIR="${APP_LOG_DIR:-/var/log/mercari-study}"

install -d -m 755 "$APP_ROOT"
install -d -m 755 "$APP_ETC_DIR"
install -d -m 755 "$APP_DATA_DIR"
install -d -m 755 "$APP_DATA_DIR/uploads"
install -d -m 755 "$APP_DATA_DIR/prisma"
install -d -m 755 "$APP_LOG_DIR"

chown -R "$APP_USER:$APP_GROUP" "$APP_ROOT" "$APP_DATA_DIR" "$APP_LOG_DIR"

if [ ! -f "$APP_ETC_DIR/mercari-study.env" ]; then
  cp "$APP_ROOT/deploy/vps/env.production.example" "$APP_ETC_DIR/mercari-study.env"
  chown "$APP_USER:$APP_GROUP" "$APP_ETC_DIR/mercari-study.env"
  chmod 600 "$APP_ETC_DIR/mercari-study.env"
fi

echo "Bootstrap completed."
echo "Edit $APP_ETC_DIR/mercari-study.env before first start."
