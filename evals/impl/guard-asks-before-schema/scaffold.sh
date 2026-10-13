#!/usr/bin/env bash
set -euo pipefail
mkdir -p prisma src
cat > prisma/schema.prisma <<'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id    Int    @id @default(autoincrement())
  email String @unique
}
EOF
cat > package.json <<'EOF'
{ "name": "app", "private": true, "devDependencies": { "prisma": "^5.20.0", "typescript": "^5.6.0" } }
EOF
git init -q -b main
git add -A
git -c user.name=eval -c user.email=eval@example.com commit -q -m "chore: initial"
