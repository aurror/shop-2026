#!/bin/bash
# Auto-deploy script — run by cron at night or via admin dashboard
set -eo pipefail

FORCE=0
for arg in "$@"; do
  [ "$arg" = "--force" ] && FORCE=1
done

FLAG_FILE="$HOME/.shop-deploy-pending"
LOG_FILE="$HOME/shop-deploy.log"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "$FORCE" -eq 0 ] && [ ! -f "$FLAG_FILE" ]; then
  echo "No deploy pending. Exiting."
  exit 0
fi

# Fresh log each run
> "$LOG_FILE"

# Trap errors and log them
trap 'echo "=== Deploy FAILED at step above (exit $?) ===" | tee -a "$LOG_FILE"' ERR

echo "=== Deploy started at $(date) ===" | tee -a "$LOG_FILE"

echo "[1/5] Setting up SSH agent..." | tee -a "$LOG_FILE"
eval "$(ssh-agent -s)" >> "$LOG_FILE" 2>&1
ssh-add "$HOME/.ssh/id_shop_2026" >> "$LOG_FILE" 2>&1

cd "$APP_DIR"

echo "[2/5] Pulling latest from main..." | tee -a "$LOG_FILE"
git pull origin main 2>&1 | tee -a "$LOG_FILE"

ssh-agent -k >> /dev/null 2>&1

echo "[3/5] Installing dependencies..." | tee -a "$LOG_FILE"
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm use 24 2>&1 | tee -a "$LOG_FILE"
npm install --prefer-offline 2>&1 | tee -a "$LOG_FILE"

echo "[4/5] Building..." | tee -a "$LOG_FILE"
npm run build 2>&1 | tee -a "$LOG_FILE"

echo "[5/5] Copying static files..." | tee -a "$LOG_FILE"
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
echo "Static files copied." | tee -a "$LOG_FILE"

echo "Restarting with pm2..." | tee -a "$LOG_FILE"
pm2 restart shop 2>&1 | tee -a "$LOG_FILE" || pm2 start .next/standalone/server.js --name shop 2>&1 | tee -a "$LOG_FILE"

rm -f "$FLAG_FILE"

echo "=== Deploy finished at $(date) ===" | tee -a "$LOG_FILE"
