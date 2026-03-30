#!/bin/bash

set -euo pipefail

SOURCE_ROOT="${SOURCE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
RUNTIME_ROOT="${RUNTIME_ROOT:-$HOME/mercari-study-line-runtime}"

mkdir -p "$RUNTIME_ROOT"

rsync -a \
  --delete \
  --exclude ".git/" \
  --exclude ".next/" \
  --exclude ".next_stale_" \
  --exclude ".next_stale_*/" \
  --exclude "coverage/" \
  --exclude "deploy/vps/" \
  --exclude ".env" \
  --exclude "prisma/dev.db" \
  --exclude "storage/uploads/" \
  "$SOURCE_ROOT/" "$RUNTIME_ROOT/"

echo "Runtime synced to $RUNTIME_ROOT"
