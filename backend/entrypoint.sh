#!/bin/sh
set -e

echo "[entrypoint] ensuring dependencies..."
npm install --prefer-offline --no-audit --no-fund || npm install

echo "[entrypoint] starting API..."
node src/config/seed.js || true
exec node src/app.js
