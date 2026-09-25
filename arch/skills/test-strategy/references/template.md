# testing.md 模板

````markdown
# 測試策略

> 模式：**A 新專案 / B 開發中、已有測試 / C 開發中、零測試**　|　最後更新：<YYYY-MM-DD>
> 上游：`docs/architecture/tech-stack.md`、`docs/db/schema.md`、`docs/api/contract.md`（缺的寫「無，依程式碼推導」）

## 指令

| 用途 | 指令 | 單一檔案 |
|---|---|---|
| 全部 | `pnpm test` | `pnpm test <path>` |
| 單元 | `pnpm test:unit` | |
| 整合 / API | `pnpm test:integration` | |
| E2E | `pnpm test:e2e` | |

`/impl:feature` 的「既有測試不能壞」一律跑「全部」那一條。

## 分層對照

| 規則類型 | 測試層 | 位置 | 備註 |
|---|---|---|---|
| DB 約束（schema 落點 = DB） | 整合 | `tests/integration/` | 一定要打真的資料庫 |
| 應用層不變量 | 單元 + 一條整合 | `src/**/*.test.ts` | |
| 狀態機轉換 | 單元 | | 非法轉換也要測 |
| 權限 | API | `tests/api/` | 經過真的認證中介層 |
| 契約錯誤碼 | API | `tests/api/` | 每個錯誤碼至少一條 |
| 關鍵流程 | E2E | `e2e/` | 每個 feature 的 happy path + 一個錯誤路徑 |

## 測試資料庫

- 隔離方式：<交易回滾 / worker schema / 測試容器>，理由：<一句話>
- 連線：`<TEST_DATABASE_URL 的來源>`（只允許本機或容器）
- migration：<測試啟動時如何套用>
- 清資料：<方式>

## fixture / factory

- 位置：`tests/factories/`
- 慣例：factory 產出的資料預設滿足所有不變量；要測不合法的情況由測試自己明確覆寫

## mock 邊界

- 替換：<金流 / 寄信 / 第三方 API / 時鐘…，以及替換的位置>
- 不替換：資料庫、自己的模組、自己的 HTTP 層

## 現況（模式 B、C）

- 基準：既有測試 N 個，全綠 / <紅的清單>
- 既有測試分層：單元 X｜整合 Y｜API Z｜E2E W
- 本次新增：<數量與區塊>

## 差距清單

| # | 區塊 | 缺什麼 | 風險 | 建議 | 狀態 |
|---|---|---|---|---|---|
| G-001 | `src/api/orders.ts` 的取消流程 | 只有 mock DB 的單元測試，唯一約束沒測 | high | 下次跑本 skill 補 / 併入 `<feature>` plan | 待處理 |

狀態：`待處理` / `已補` / `已併入 plan`

## 疑似缺陷

| # | 位置 | 現況行為 | 預期（BR-ID 或理由） | 狀態 |
|---|---|---|---|---|
| S-001 | `src/domain/order.ts:88` | 已出貨仍可取消 | BR-order-021 | 交 `/impl:fix` |

這裡的每一條都**沒有**對應的測試留在 repo 裡（避免把 bug 鎖死或留下紅測試）；由 `/impl:fix` 寫 regression test。

## 變更紀錄

| 日期 | 變更 |
|---|---|
````
