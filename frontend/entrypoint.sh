#!/bin/sh
set -e

echo "[entrypoint] ensuring dependencies..."
npm install --prefer-offline --no-audit --no-fund || npm install

echo "[entrypoint] starting Next.js..."
exec npm run dev
