#!/usr/bin/env bash
set -euo pipefail
mkdir -p apps/console/src/pages apps/web/src/screens
cat > CLAUDE.md <<'EOF'
# shop

## 技術約束

- 前端：React 19 + TypeScript + Tailwind CSS v4
- UI 風格（依介面，同一個介面內不混用）：`apps/console` → tonal-ui；`apps/web` → calm-ui；寫畫面前先載入對應 skill，只用該介面的 token
EOF
cat > package.json <<'EOF'
{ "name": "shop", "private": true, "dependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" }, "devDependencies": { "tailwindcss": "^4.0.0", "typescript": "^5.6.0" } }
EOF
git init -q -b main
git config user.name eval
git config user.email eval@example.com
git add -A
git commit -q -m "chore: initial"
