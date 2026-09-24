# 輸出模板

寫入 `docs/api/contract.md`。既有檔案採合併：沿用既有端點與錯誤碼，變動記進「變更紀錄」，破壞性的另列。

````markdown
# API 契約

> 風格：<REST / GraphQL / tRPC / gRPC>　|　版本策略：<不版本化 / 路徑版本 / header>
> 客戶端：<web / iOS / Android / 第三方>　|　最低支援客戶端版本：<版本>
> 最後更新：<YYYY-MM-DD>　|　來源模型：`docs/domain/model/`（<日期>）

## 慣例

| 項目 | 做法 |
|---|---|
| 欄位大小寫 | camelCase |
| 時間 | ISO 8601 帶時區 |
| 金額 | 字串定點數 + 獨立 currency 欄位 |
| 識別碼 | 字串 |
| 分頁 | cursor：`?limit&cursor` → `{ items, nextCursor }` |
| 排序 | `?sort=<白名單欄位>&order=asc\|desc` |
| 業務規則失敗 | HTTP 409 |
| 權限失敗 | <403 / 404，擇一並寫理由> |

## 認證與授權

- 認證方式、token 效期、刷新流程
- 客戶端版本 header（相容性統計用）

## 客戶端必須遵守

<照 `compat.md` 的四條：忽略未知欄位、未知列舉值 fallback、未知錯誤碼預設處理、不依賴欄位順序。沒有這段，所有新增都是破壞性變更。>

## 端點

### POST /orders/{id}/cancel

- **來源**：`order.md#Order.cancel`（命令）、`BR-order-031`
- **權限**：訂單擁有者，或具備 `order:manage` 的管理者
- **冪等**：需要 `Idempotency-Key`
- **request**

  | 欄位 | 型別 | 必填 | 來源 | 說明 |
  |---|---|---|---|---|
  | reason | string | 是 | `BR-order-033` | 1–200 字 |

- **response 200**

  | 欄位 | 型別 | 來源 |
  |---|---|---|
  | id | string | `order.md#Order.id` |
  | status | string | `order.md#Order.status`（列舉） |
  | cancelledAt | string | `order.md#Order.cancelledAt` |

- **錯誤**：`ORDER_NOT_CANCELLABLE`、`ORDER_CANCEL_WINDOW_EXPIRED`、`FORBIDDEN`

## 錯誤碼

| 錯誤碼 | status | 何時發生 | 客戶端該怎麼處理 | 來源 |
|---|---|---|---|---|
| `ORDER_CANCEL_WINDOW_EXPIRED` | 409 | 付款後超過 7 天 | 顯示訊息，隱藏取消按鈕 | `BR-order-031` |
| `ORDER_NOT_CANCELLABLE` | 409 | 目前狀態不允許取消 | 重新取資料後更新畫面 | `order.md#Order.status` |

### 錯誤 envelope

<全域一種形狀，見 `mapping.md`。>

## 命令與查詢落點

| 模型元素 | 端點 | 備註 |
|---|---|---|
| `order.md#Order.cancel` | `POST /orders/{id}/cancel` | |
| `order.md#Order.archive` | **未落地** | <原因> |

## 規則失敗情境覆蓋

| BR-ID | 失敗情境 | 錯誤碼 |
|---|---|---|
| BR-order-031 | 超過可取消期限 | `ORDER_CANCEL_WINDOW_EXPIRED` |
| BR-order-034 | <摘要> | **未覆蓋** — <原因> |

## 事件與推播

| 領域事件 | 推播 / webhook | payload | 去重鍵 |
|---|---|---|---|

## 傳輸關切

- 冪等：哪些端點需要、鍵放哪、重複時回什麼
- 重試：可重試的錯誤、退避策略、絕對不可重試的
- 限流：門檻、429 的 header
- 上傳 / 下載：路徑、大小限制、簽章效期

## 相容性

- 版本策略與理由
- 目前 deprecated 的欄位 / 端點，以及移除條件
- 最低支援客戶端版本，低於它回什麼

## 破壞性變更

| 變更 | 影響 | 替代方案 | 棄用期 | 移除條件 |
|---|---|---|---|---|

## 上游回饋

| # | 類型 | 問題 | 發現於 | 狀態 |
|---|---|---|---|---|

<同步一份到相關 feature 的 plan.md「上游回饋」表，交給 `/domain:feedback`；沒有就整張表留空。>

## 變更紀錄

| 日期 | 變動 |
|---|---|
````

## 對話摘要格式

1. 寫入的檔案與這次動了什麼
2. 規模：端點數、錯誤碼數、事件數
3. 覆蓋：模型命令 N 落地 M；BR 失敗情境 N 條對應 M 個錯誤碼（未覆蓋逐條列原因）
4. 破壞性變更與對舊版客戶端的影響
5. 最值得確認的 3 個假設
6. 下一步：`/impl:plan`；伺服器端 feature 先於客戶端 feature
