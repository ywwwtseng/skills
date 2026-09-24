# API 風格

Step 0 決定風格後只讀對應段。全份契約用同一種做法（SKILL 核心規則 5）。

## 怎麼選

| 情境 | 風格 |
|---|---|
| 有行動端、有第三方、需要快取與標準工具 | **REST**（預設） |
| 客戶端畫面差異大、想自己決定要什麼欄位 | GraphQL |
| 前後端同一個 repo、同一種語言（TypeScript） | tRPC |
| 服務之間、需要串流與強型別 | gRPC |

**有行動端時預設 REST**：HTTP 快取、離線佇列、重試、抓包除錯、第三方 SDK 都是照 REST 的模型長出來的。GraphQL 在行動端的主要痛點是快取與離線比較難做對，而且一個過重的 query 在弱網下沒有辦法分段。

## REST

- 資源用複數名詞，動作用子路徑動詞（`POST /orders/{id}/cancel`）。
- 慣例段要寫死的：大小寫風格（`camelCase` 或 `snake_case`，全份一種）、時間格式、金額表示、分頁形狀、排序參數、篩選語法。
- 分頁預設 cursor：`?limit=20&cursor=<token>`，回 `{ items, nextCursor }`。`nextCursor` 為 null 代表結束。
- 條件請求：`ETag` + `If-None-Match` 省流量；`If-Match` 做樂觀鎖（對應 schema 的 version 欄）。
- 冪等：`Idempotency-Key` header，伺服器端記錄鍵與結果，重複時回同一個結果。
- 限流：429 + `Retry-After`。
- 部分回應（`?fields=`）只在真的有頻寬問題時做，它會讓契約難以承諾。

## GraphQL

- schema 即契約：type、query、mutation 對應模型的查詢與命令。**一個 mutation 一個命令**，不要做萬用 update。
- 錯誤分兩層：傳輸層錯誤走 `errors`，**業務規則失敗要放進 payload 的 union / result type**，不要塞進 `errors`——客戶端無法可靠地從 `errors` 分辨該顯示什麼。
- 分頁照 Relay cursor connection（`edges`／`pageInfo`），全份統一。
- 相容性：欄位只能新增與標 `@deprecated`，不能刪、不能改型別（`compat.md` 的規則同樣適用，而且 GraphQL 沒有版本可以退）。
- 一定要設查詢深度與複雜度上限，否則單一 query 就能拖垮資料庫。

## tRPC

- procedure 對應命令與查詢，型別直接從伺服器端推導 —— 但**型別不等於契約**：錯誤碼、權限、冪等、相容性一樣要寫進 `contract.md`。
- 只適合前後端同 repo 同語言。有行動端（Swift / Kotlin）時不要選。
- 錯誤用 `TRPCError` 的 code + 自訂的業務錯誤碼，兩層分開。

## gRPC

- proto 即契約；欄位編號一經使用永不重用（這是它的相容性機制）。
- 新增欄位安全、改型別與改編號是破壞性的。
- 錯誤用標準 status code + `google.rpc.ErrorInfo` 帶業務錯誤碼。
- 瀏覽器要走 grpc-web，行動端 SDK 成熟但除錯工具比 REST 少。

## 共通：契約文件仍然要寫

OpenAPI / GraphQL schema / proto 是**機器讀的介面定義**，不是契約。它們表達不出來的東西，正是客戶端最需要知道的：

- 每個錯誤碼**何時**發生、客戶端**該怎麼處理**
- 哪些操作可重試、要不要帶冪等鍵
- 權限規則與它們的來源 BR
- 相容性承諾與棄用時程

所以 `docs/api/contract.md` 是主文件，OpenAPI / proto 是由它生出來的產物（由 `/impl:plan` 排成 task），不是反過來。
