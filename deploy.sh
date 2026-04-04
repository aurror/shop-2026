#!/bin/bash
# Auto-deploy script — run by cron at night or manually
set -e

FLAG_FILE="$HOME/.shop-deploy-pending"
LOG_FILE="/var/log/shop-deploy.log"
APP_DIR="/home/flo/shop-2026"

if [ ! -f "$FLAG_FILE" ]; then
  echo "No deploy pending. Exiting."
  exit 0
fi

echo "=== Deploy started at $(date) ===" >> "$LOG_FILE"

cd "$APP_DIR"

# Pull latest
git pull origin main >> "$LOG_FILE" 2>&1

# Install deps (only if package-lock changed)
npm ci --prefer-offline >> "$LOG_FILE" 2>&1

# Build
npm run build >> "$LOG_FILE" 2>&1

# Copy static files for standalone mode
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# Restart with pm2
pm2 restart shop >> "$LOG_FILE" 2>&1 || pm2 start .next/standalone/server.js --name shop >> "$LOG_FILE" 2>&1

# Remove flag
rm -f "$FLAG_FILE"

echo "=== Deploy finished at $(date) ===" >> "$LOG_FILE"
