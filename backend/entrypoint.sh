#!/bin/sh
set -e

if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  echo "[entrypoint] node_modules missing or incomplete — running npm install..."
  npm install
fi

echo "[entrypoint] starting API..."
node src/config/seed.js || true
exec node src/app.js
