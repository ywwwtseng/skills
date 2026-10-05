# testing.md 模板

````markdown
# 測試策略

> 模式：**A 新專案 / B 開發中、已有測試 / C 開發中、零測試**　|　最後更新：<YYYY-MM-DD>
> 上游：`docs/architecture/tech-stack.md`、`docs/db/schema.md`、`docs/api/contract.md`（缺的寫「無，依程式碼推導」）

## 指令

| 用途 | 指令 | 單一檔案 |
|---|---|---|
| 全部 | `pnpm test` | `pnpm test <path>` |
| 受影響 | `pnpm test:affected` | |
| 單元 | `pnpm test:unit` | |
| 整合 / API | `pnpm test:integration` | |
| E2E | `pnpm test:e2e` | |
| 冒煙 | `pnpm test:smoke` | |

`/impl:feature`、`/impl:fix` 每次驗收的「既有測試不能壞」跑「受影響」那一條；「全部」留給 `/git:push` 推之前、`/impl:verify` 與 CI。`test:smoke` 不含在「全部」裡（要建置、要模擬器），由 `/impl:verify`、`/git:push` 與 UI task 的驗收另外跑。

### 交付前全套會抓的改動

改動碰到下列任一項時，「受影響」追不到（它靠 import 關係找測試）。每個 task 仍**不**改跑「全部」（全部只在交付前跑一次），而是加跑最可能波及的測試檔，並在 plan 備註寫明動到什麼，交付前的全套紅了時從這些 task 找起：

- migration、ORM schema
- 測試的 setup / fixture / factory：`<路徑>`
- 設定檔：`package.json`、lockfile、`tsconfig`、測試設定、`.env.example`
- 共用模組：`<被大量 import 的路徑，例如 src/lib/、src/domain/ 的根>`
- 「受影響」指令報錯，或回報找不到任何測試

## 分層對照

| 規則類型 | 測試層 | 位置 | 備註 |
|---|---|---|---|
| DB 約束（schema 落點 = DB） | 整合 | `tests/integration/` | 一定要打真的資料庫 |
| 應用層不變量 | 單元 + 一條整合 | `src/**/*.test.ts` | |
| 狀態機轉換 | 單元 | | 非法轉換也要測 |
| 權限 | API | `tests/api/` | 經過真的認證中介層 |
| 契約錯誤碼 | API | `tests/api/` | 每個錯誤碼至少一條 |
| 關鍵流程 | E2E | `e2e/` | 每個 feature 的 happy path + 一個錯誤路徑 |
| 啟動得起來 | 冒煙 | `e2e/smoke/` | 有畫面就一定有；打包 + 真的 binary 啟動 |

## 冒煙測試

- 打包：`<指令>`（CI：有 / 無）
- 啟動：`<建置指令>` → `<啟動斷言的工具與檔案>`（CI：有 / 只在本機）
- 首頁斷言的元素：`<元素>`
- 需要重建 binary 的時機：<新增或升級原生依賴後；判斷方式>

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
