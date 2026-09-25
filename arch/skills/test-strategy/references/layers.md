# 測試分層對照

## 四層定義

| 層 | 測什麼 | 替換什麼 | 速度 |
|---|---|---|---|
| **單元** | 模型與純邏輯：計算、約束判斷、狀態轉換、值物件 | 不碰 I/O；時間用注入的時鐘 | 毫秒 |
| **整合** | 應用層 + 真的資料庫：repository、交易、DB 約束、並行、migration | 只替換外部服務（金流、寄信、第三方 API） | 百毫秒 |
| **API** | 從 HTTP 進去：路由、認證授權中介層、request 驗證、錯誤碼與 envelope | 同整合層 | 百毫秒 |
| **E2E** | 從畫面進去：關鍵使用者流程 | 盡量不替換；外部服務用 sandbox 或 stub server | 秒 |

API 層與整合層通常共用同一套測試資料庫與 setup，差別只在入口。專案小的時候可以合成一條 `test:integration`。

## 規則類型 → 預設測試層

| 來源 | 類型 | 預設層 | 為什麼 |
|---|---|---|---|
| schema 落點表 | 落點 = DB 約束（`UNIQUE`、`CHECK`、`NOT NULL`、外鍵） | **整合** | 約束在資料庫裡，mock 掉資料庫就測不到 |
| schema 落點表 | 落點 = 應用層 | 單元 + 一條整合 | 單元驗邏輯；整合確認寫入路徑沒有繞過它 |
| schema | 並行策略（樂觀鎖、`SELECT … FOR UPDATE`） | **整合** | 要兩條真的連線同時寫才看得到 |
| model | 狀態機的合法 / 非法轉換 | 單元 | 純邏輯 |
| model | 狀態轉換後的持久化 | 整合 | 確認存進去的就是轉換後的狀態 |
| BR 計算 | 金額、數量、折扣、四捨五入 | 單元 | 邊界值多，要快；BR 的每組「輸入 → 預期結果」一個案例 |
| BR 約束 | 輸入限制、前置條件 | 單元 | |
| BR 權限 | 誰能做什麼 | **API** | 權限常常寫在中介層，繞過 HTTP 測就漏掉了 |
| BR 時間 | 期限、到期、排程 | 單元（注入時鐘） | 不要 `sleep`，不要依賴真實時間 |
| BR 副作用 | 寄信、推播、webhook、事件 | 整合（替換外部邊界、斷言有被呼叫） | |
| contract | 每個錯誤碼 | **API** | 客戶端看到的是 HTTP 狀態 + 錯誤碼 + envelope，要從 HTTP 驗 |
| contract | 冪等鍵 | API | 同一個鍵送兩次 |
| screens | 關鍵流程（happy path + 一個錯誤路徑） | E2E | |
| screens | 其他狀態（空、錯誤、載入、權限不足） | 元件測試 | E2E 太慢，逐一覆蓋會讓整套跑不動 |

## mock 邊界

**可以替換**：不是我們的、而且測試時不能真的呼叫的東西。

- 金流、簡訊、寄信、推播服務
- 第三方 API
- 系統時間、亂數、UUID（需要決定性時）

**不要替換**：

- 資料庫——用測試資料庫
- 自己的模組、自己的 repository——替換掉就是在測 mock
- 自己的 HTTP 層——用測試客戶端打真的 app 實例

替換的位置選在**邊界的最外面**（HTTP client 或 SDK wrapper），不要 mock 自己的 service 方法。

## 測試資料庫隔離

| 方式 | 做法 | 適合 | 注意 |
|---|---|---|---|
| **交易回滾** | 每個測試開一個交易，結束時 rollback | 單一連線的一般 CRUD；最快 | 被測程式碼自己開交易或用多條連線時失效；測不到 commit 後才觸發的東西（deferred constraint、trigger） |
| **每個 worker 一個 schema / database** | 平行測試的每個 worker 用自己的 schema，測試間用 `TRUNCATE` 清 | 需要平行、需要真的 commit | 清資料要照外鍵順序或 `TRUNCATE … CASCADE` |
| **測試容器** | Testcontainers 每次測試執行起一個乾淨的資料庫容器 | CI 與本機環境一致；需要特定 DB 版本或擴充 | 需要 Docker；啟動多幾秒，所以一次執行起一個，不要每個測試起一個 |

預設選法：

1. 有並行、trigger、deferred constraint 要測 → 不能只用交易回滾
2. 專案已經有 `docker-compose.yml` 的資料庫 → 在同一個服務上開一個獨立的測試 database（例如 `app_test`），加上 worker schema
3. 沒有 → 測試容器
4. SQLite 專案 → 每個測試一個記憶體資料庫或暫存檔

**不要**用 SQLite 代替 Postgres / MySQL 跑整合測試：約束、型別、交易語意都不一樣，測過了不代表正式環境會過。

## 各技術棧的測試工具

| 技術棧 | 單元 | 整合 / API | E2E |
|---|---|---|---|
| Node / TypeScript | Vitest（`/arch:init` 預設） | Vitest + `@testcontainers/postgresql` 或既有 compose；API 用 `supertest` 或框架內建（Fastify `inject`、Hono `app.request`） | Playwright |
| Next.js | Vitest + Testing Library | Route Handler 直接呼叫或 `next-test-api-route-handler` | Playwright |
| Python | pytest | pytest + `testcontainers` 或 `pytest-postgresql`；FastAPI `TestClient` / `httpx.AsyncClient`；Django `TestCase` | Playwright（Python） |
| Go | `go test` | `go test` + `testcontainers-go`；`httptest` | Playwright |
| React Native / Expo | Jest + `@testing-library/react-native` | —（伺服器端另計） | Maestro（預設，YAML、較穩定）/ Detox |
| Flutter | `flutter test` | — | `integration_test` / Maestro |

打亂順序的旗標：Vitest `--sequence.shuffle`、Jest `--randomize`、pytest `-p random_order`（需 `pytest-random-order`）、`go test -shuffle=on`。

## 不穩定測試的常見原因

| 原因 | 修法 |
|---|---|
| 測試之間共用資料 | 每個測試自己用 factory 建資料；隔離方式見上表 |
| 依賴執行順序 | 打亂順序跑一次就會現形；讓每個測試自己準備前置狀態 |
| 依賴真實時間 | 注入時鐘；不要 `sleep` |
| 等待非同步用固定時間 | 改成等條件成立（Playwright 的 auto-wait、`waitFor`） |
| 依賴外部網路 | 替換邊界（見 mock 邊界） |
| 自動遞增 ID 寫死在斷言 | 斷言用建立時拿到的 ID |
