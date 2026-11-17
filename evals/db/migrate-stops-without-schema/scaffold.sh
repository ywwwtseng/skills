#!/usr/bin/env bash
set -euo pipefail
cat > package.json <<'EOF'
{ "name": "shop", "private": true, "devDependencies": { "drizzle-kit": "^0.28.0", "typescript": "^5.6.0" } }
EOF
git init -q -b main
git config user.name eval
git config user.email eval@example.com
git add -A
git commit -q -m "chore: initial"
