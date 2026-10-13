#!/usr/bin/env bash
set -euo pipefail
mkdir -p lib app docs/security
cat > lib/auth.js <<'EOF'
// Returns { shopId } for a valid merchant token, or null.
export function verifyMerchantToken(token, secret) {
  if (!token.startsWith('Bearer ')) return null;
  return { shopId: token.slice(7, 15) };
}
EOF
cat > app/orders.js <<'EOF'
import { verifyMerchantToken } from '../lib/auth.js';

export function listOrders(req, db, secret) {
  const merchant = verifyMerchantToken(req.headers.authorization ?? '', secret);
  if (!merchant) return { status: 401 };
  const shopId = req.query.shopId;
  return { status: 200, body: db.orders.filter((o) => o.shopId === shopId) };
}
EOF
cat > package.json <<'EOF'
{ "name": "shop", "private": true, "type": "module", "scripts": { "test": "node --test" } }
EOF
cat > docs/security/audit-2026-10-13.md <<'EOF'
# Security Audit Report

> 專案：shop　|　commit：init　|　日期：2026-10-13

```
CRITICAL  1
HIGH      1
MEDIUM    0
LOW       0
```

## Findings

### [CRITICAL] 商家 token 沒有驗證簽章
File: `lib/auth.js:2-4`
Source: Claude review（信心：高）
CWE: CWE-347
根因: 只檢查 `Bearer ` 前綴就回傳 shopId，沒有驗 HMAC 簽章。
Fix: 用 `secret` 重算 HMAC 並以 timing-safe 比對。回歸測試：`verifyMerchantToken('Bearer 12345678', 's')` 應回 null。

### [HIGH] 訂單查詢用 query string 的 shopId
File: `app/orders.js:6-7`
Source: Claude review（信心：高）
CWE: CWE-639
根因: 驗證通過的是 `merchant`，查詢卻用 `req.query.shopId`。
Fix: 改用 `merchant.shopId`。回歸測試：shopA 的 token 帶 `?shopId=shopB` 不得回傳 shopB 的訂單。

## 已排除

無。

## 建議處理順序

1. 修 token 驗證（CRITICAL）
2. 訂單查詢改用 merchant.shopId（HIGH）
EOF
git init -q -b main
git add lib app package.json
git -c user.name=eval -c user.email=eval@example.com commit -q -m "chore: initial"
