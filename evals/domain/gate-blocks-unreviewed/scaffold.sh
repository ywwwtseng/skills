#!/usr/bin/env bash
set -euo pipefail
mkdir -p docs/domain/business-rules src/orders
cat > docs/domain/business-rules/order-cancellation.md <<'EOF'
# Business Rules — 取消訂單

> 產生日期：2026-10-13 ｜ 版本：1 ｜ 狀態：待審查
> 影響範圍：`src/orders/**`

## 規則

### 訂單（ORD）

#### BR-ORD-001 已出貨的訂單不能取消

#### BR-ORD-002 取消後全額退款到原付款方式

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
}
EOF
