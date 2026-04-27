#!/usr/bin/env bash
set -euo pipefail

echo "Syncing database schema..."
npx prisma db push --skip-generate

if [ "${AUTO_SEED:-false}" = "true" ]; then
  USER_COUNT=$(node -e "const {PrismaClient}=require('@prisma/client'); const prisma=new PrismaClient(); prisma.user.count().then((count)=>{console.log(count);}).catch(()=>{console.log('0');}).finally(()=>prisma.\$disconnect());")
  if [ "${USER_COUNT}" = "0" ]; then
    echo "Seeding initial data..."
    npm run prisma:seed
  else
    echo "Database already has data, skipping seed."
  fi
fi

echo "Starting backend..."
node dist/src/main.js
