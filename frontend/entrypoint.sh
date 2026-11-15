#!/bin/sh
set -e

if [ ! -d "node_modules" ] || [ ! -d "node_modules/next" ]; then
  echo "[entrypoint] node_modules missing — running npm install..."
  npm install
fi

echo "[entrypoint] starting Next.js..."
exec npm run dev
