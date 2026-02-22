#!/bin/sh
set -e

echo "📦 Running DB migrations..."
node dist/db/migrate.js

echo "🌱 Running DB seed..."
node dist/db/seed.js || true

echo "🚀 Starting API..."
exec node dist/index.js
