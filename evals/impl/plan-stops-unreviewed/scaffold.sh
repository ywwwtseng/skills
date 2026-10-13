#!/usr/bin/env bash
set -euo pipefail
mkdir -p docs/domain/business-rules src/orders
cat > docs/domain/business-rules/order-cancellation.md <<'EOF'
# Business Rules — 取消訂單

> 產生日期：2026-10-13 ｜ 版本：1 ｜ 狀態：待審查
> 影響範圍：`src/orders/**`

## 問題與目標
買家下單後可以自己取消訂單。

## 規則

### 訂單（ORD）

#### BR-ORD-001 已出貨的訂單不能取消
- 輸入：狀態為 shipped 的訂單 → 預期：拒絕，錯誤碼 ORDER_ALREADY_SHIPPED

#### BR-ORD-002 取消後全額退款到原付款方式
- 輸入：狀態為 paid 的訂單 → 預期：狀態變 cancelled，建立一筆等額退款

## 假設清單

| 規則 | 假設 | 若不成立 |
|---|---|---|
| BR-ORD-001 | 部分出貨視同已出貨 | 要改成逐品項取消 |
EOF
cat > src/orders/order.ts <<'EOF'
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'cancelled';
export interface Order {
  id: string;
  status: OrderStatus;
  amount: number;
}
EOF
cat > package.json <<'EOF'
{
  "name": "shop",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:affected": "vitest run --changed origin/main"
  },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0" }
}
EOF
git init -q -b main
git add -A
git -c user.name=eval -c user.email=eval@example.com commit -q -m "chore: initial"
