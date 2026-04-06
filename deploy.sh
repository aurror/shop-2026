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

# --- Verbose diagnostics (helps debug web-UI vs CLI differences) ---
echo "[env] USER=$(whoami)  HOME=$HOME  SHELL=$SHELL" | tee -a "$LOG_FILE"
echo "[env] APP_DIR=$APP_DIR  PWD=$(pwd)" | tee -a "$LOG_FILE"

# Strip leaked internal Next.js env vars — if __NEXT_PRIVATE_STANDALONE_CONFIG
# is set (happens when spawned from the running Next.js server), `next build`
# short-circuits config loading and reuses the runtime config, which breaks the build.
for var in $(env | grep -o '^__NEXT_PRIVATE[^=]*'); do
  echo "[env] Unsetting leaked Next.js var: $var" | tee -a "$LOG_FILE"
  unset "$var"
done

echo "[1/5] Setting up SSH agent..." | tee -a "$LOG_FILE"
eval "$(ssh-agent -s)" >> "$LOG_FILE" 2>&1
ssh-add "$HOME/.ssh/id_shop_2026" >> "$LOG_FILE" 2>&1

cd "$APP_DIR"

echo "[2/5] Pulling latest from main..." | tee -a "$LOG_FILE"
git fetch origin main 2>&1 | tee -a "$LOG_FILE"
git reset --hard origin/main 2>&1 | tee -a "$LOG_FILE"
echo "[git] HEAD is now $(git rev-parse --short HEAD)" | tee -a "$LOG_FILE"

ssh-agent -k >> /dev/null 2>&1

echo "[3/5] Installing dependencies..." | tee -a "$LOG_FILE"
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm install 24 2>&1 | tee -a "$LOG_FILE"
nvm use 24 2>&1 | tee -a "$LOG_FILE"
echo "[node] $(node --version)  npm $(npm --version)  path: $(which node)" | tee -a "$LOG_FILE"
if [ -f "$APP_DIR/package-lock.json" ]; then
  npm ci --include=dev 2>&1 | tee -a "$LOG_FILE"
else
  npm install 2>&1 | tee -a "$LOG_FILE"
fi

echo "[4/5] Building..." | tee -a "$LOG_FILE"
# Clear stale build cache (especially important when switching bundlers)
rm -rf .next
echo "[build] NODE_ENV=${NODE_ENV:-<unset>}  __NEXT_PRIVATE_STANDALONE_CONFIG=${__NEXT_PRIVATE_STANDALONE_CONFIG:+SET (THIS IS BAD — would poison the build)}" | tee -a "$LOG_FILE"
npm run build 2>&1 | tee -a "$LOG_FILE"

echo "[5/5] Copying static files..." | tee -a "$LOG_FILE"
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
echo "Static files copied." | tee -a "$LOG_FILE"

echo "Restarting with pm2..." | tee -a "$LOG_FILE"
pm2 restart shop 2>&1 | tee -a "$LOG_FILE" || pm2 start .next/standalone/server.js --name shop 2>&1 | tee -a "$LOG_FILE"

rm -f "$FLAG_FILE"

echo "=== Deploy finished at $(date) ===" | tee -a "$LOG_FILE"
