#!/usr/bin/env bash
set -euo pipefail
mkdir -p docs/domain/business-rules docs/domain/model docs/architecture
cat > docs/domain/business-rules/order-cancellation.md <<'EOF'
# Business Rules — 取消訂單

> 產生日期：2026-10-13 ｜ 版本：1 ｜ 狀態：已審查（2026-10-13）
> 影響範圍：`src/orders/**`

## 規則

### 訂單（ORD）

#### BR-ORD-001 已出貨的訂單不能取消
- 輸入：狀態為 shipped 的訂單 → 預期：拒絕，錯誤碼 ORDER_ALREADY_SHIPPED

#### BR-ORD-002 取消後全額退款到原付款方式
- 輸入：狀態為 paid 的訂單 → 預期：狀態變 cancelled，建立一筆等額退款
EOF
cat > docs/domain/model/README.md <<'EOF'
# Domain Model

## 範圍
訂單的取消。

## 來源規則文件
| 文件 | 版本 |
|---|---|
| `business-rules/order-cancellation.md` | 1 |

## 模型總覽
| 聚合 | 聚合根 | 檔案 |
|---|---|---|
| 訂單 | Order | `order.md` |

## 追溯表
| 規則 | 模型元素 |
|---|---|
| order-cancellation/BR-ORD-001 | INV-ORD-001、CancelOrder |
| order-cancellation/BR-ORD-002 | CancelOrder、OrderCancelled、Refund |
EOF
cat > docs/domain/model/order.md <<'EOF'
# 訂單 Order

> 最後更新：2026-10-13

## 聚合
- **聚合根**：Order
- **包含**：Refund（實體）
- **守的不變量**：INV-ORD-001

## 列舉

### 訂單狀態 OrderStatus
| 值 | 識別名 | 終態 | 來源 |
|---|---|---|---|
| 待付款 | Pending | 否 | order-cancellation/BR-ORD-002 |
| 已付款 | Paid | 否 | order-cancellation/BR-ORD-002 |
| 已出貨 | Shipped | 否 | order-cancellation/BR-ORD-001 |
| 已取消 | Cancelled | 是 | order-cancellation/BR-ORD-002 |

## 實體

### 訂單 Order（聚合根）
- **屬性**：
  | 屬性 | 型別 | 說明 |
  |---|---|---|
  | id | 識別碼 | |
  | buyerId | 識別碼 | 下單的買家 |
  | status | OrderStatus | 初始 Pending |
  | amount | 金額（整數，最小單位） | 成立時凍結 |
- **不變量**：
  - INV-ORD-001 狀態為 Shipped 的訂單不能轉成 Cancelled（order-cancellation/BR-ORD-001）

### 退款 Refund
- **屬性**：
  | 屬性 | 型別 | 說明 |
  |---|---|---|
  | id | 識別碼 | |
  | orderId | 識別碼 | 所屬訂單 |
  | amount | 金額（整數，最小單位） | 等於訂單金額 |

## 關聯
- 訂單 1 → 0..1 退款；訂單擁有退款；訂單消失時退款一併刪除

## 命令
| 命令 | 執行者 | 前置條件 | 結果 | 失敗時 | 來源 |
|---|---|---|---|---|---|
| CancelOrder(orderId) | 買家本人 | INV-ORD-001 | 狀態 → Cancelled；已付款的建立等額 Refund；發出 OrderCancelled | 已出貨 → 拒絕 ORDER_ALREADY_SHIPPED | order-cancellation/BR-ORD-001、BR-ORD-002 |

## 查詢
| 查詢 | 執行者 | 回傳 |
|---|---|---|
| GetOrder(orderId) | 買家本人 | 訂單與它的退款 |

## 領域事件
| 事件 | 何時 | 內容 |
|---|---|---|
| OrderCancelled | 取消成功 | orderId、是否退款 |
EOF
cat > docs/architecture/tech-stack.md <<'EOF'
# Tech Stack

- Backend：Node.js + Hono，REST API，JSON
- Database：PostgreSQL 16，遷移工具 Drizzle Kit
- 認證：session cookie
- 客戶端：一個 Web（React）

## 約束與慣例
- 資料表與欄位用 snake_case
EOF
git init -q -b main
git config user.name eval
git config user.email eval@example.com
git add -A
git commit -q -m "chore: initial"
