#!/usr/bin/env bash
set -euo pipefail
cat > README.md <<'EOF'
# shop

二手書交易平台。
EOF
git init -q -b main
git config user.name eval
git config user.email eval@example.com
git add -A
git commit -q -m "chore: initial"
