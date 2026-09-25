---
name: init
description: 讀 docs/architecture/tech-stack.md 的技術選型決策，把專案實際建起來：repo 骨架、官方 scaffold 指令、lint / format / test / tsconfig、.env.example、CLAUDE.md 約束段落，最後跑一次驗證確認能 build。當使用者說「初始化專案」「建專案骨架」「照 tech-stack 把專案建起來」「scaffold 專案」，或剛跑完 /arch:tech-stack 要開工時使用。
---

# Init

把 `/arch:tech-stack` 產出的決策文件變成可以跑的專案骨架。本 skill 只建骨架與設定，**不實作業務功能**。

## 核心規則

1. **一切依 `docs/architecture/tech-stack.md`。** 文件沒寫的技術不要自行加裝（狀態管理、UI 套件、測試以外的工具）；真的需要時先用 `AskUserQuestion` 問。
2. **優先用官方 scaffold CLI**（`create-next-app`、`create expo`、`npm create vite`、`uv init`、`go mod init` 等），不要手寫 `package.json` 與設定檔。指令與旗標見 `references/scaffold.md`。
3. **所有指令都要 non-interactive**（`--yes`、`--no-git`、`--skip-install` 等），避免卡在互動提示。
4. **不 commit、不 push。** 骨架建完交給 `/git:commit`。
5. **不寫入 secrets。** 只產 `.env.example`（key + 說明 + 假值），真實值請使用者自己填進 `.env`（並確認 `.gitignore` 有擋）。
6. **在當前目錄就地建立**，不另外開子目錄（除非文件的架構模式是 Monorepo，骨架本來就有 `apps/` / `packages/`）。scaffold CLI 若只能建新目錄，建在暫存位置再把內容搬進來。
7. **每建完一個 app / package 就驗證一次**（typecheck / lint / build），失敗當場修，不要累積到最後。

## 流程

### Step 0：讀決策與盤點現況

1. 讀 `docs/architecture/tech-stack.md`，抓出：架構模式、各層選擇、「專案架構」的目錄骨架、「約束與慣例」、「未決事項」。
2. 盤點當前目錄：是否已有 `package.json` / `go.mod` / `pyproject.toml`、是否是 git repo、是否已有 `apps/`、`src/`。
3. 決策文件不存在時，用 `AskUserQuestion` 問：
   - 先跑 `/arch:tech-stack`（推薦）
   - 我直接口述技術棧（收到後仍先寫出 `docs/architecture/tech-stack.md` 再繼續）

### Step 1：確認執行範圍（1–2 題）

用 `AskUserQuestion` 問，不要純文字開放式提問：

| 主題 | 選項方向 |
|---|---|
| 這次要做到哪 | 只建骨架與設定檔（不安裝） / 骨架 + 安裝依賴 + 驗證通過（預設） / 再加上本機資料庫與 migration |
| 既有檔案處理（僅當目錄非空時） | 保留既有檔案、只補缺的 / 我確認可以覆蓋衝突檔案 |

覆蓋任何既有檔案前，先在對話中列出會被改動的檔案清單。

### Step 2：建立骨架

依決策文件的架構模式：

- **單一應用**：直接在當前目錄跑該框架的 scaffold。
- **Monorepo**：先建 workspace 檔（`pnpm-workspace.yaml` / `package.json` 的 `workspaces` / `go.work` / `uv` workspace）與 `turbo.json`，再逐一建 `apps/*`，最後建文件列出的 `packages/*`（`types`、`config` 等最小內容即可）。
- **Polyrepo**：只建文件指定給當前目錄的那一個 repo，其餘 repo 寫進 `docs/architecture/tech-stack.md` 的「未決事項」並在摘要中提醒。

同時建立：`.gitignore`、`.env.example`、`README.md`（專案名、啟動指令、目錄說明）。不是 git repo 時問使用者要不要 `git init`。

### Step 3：工具鏈與契約

依「約束與慣例」段落設定，缺項則用該語言的主流預設：

- 型別檢查（`tsconfig.json` strict / `mypy` / `go vet`）
- lint + format（優先單一工具：Biome / Ruff / golangci-lint）
- 測試框架與一個會通過的範例測試（Vitest / pytest / `go test`）
- 契約單一來源：zod schema / Prisma schema / OpenAPI spec 的檔案位置先建好空殼
- 統一的指令入口：`typecheck`、`lint`、`test`、`build`、`dev`（monorepo 走 turbo pipeline）

### Step 4：資料庫與 infra（範圍有選才做）

- 依 Database 選型建 ORM 設定與第一份 schema 檔（只含決策文件提到的實體；沒有就留空 schema + 一則註解）。
- 需要本機服務時給 `docker-compose.yml`（Postgres / Redis），不自動啟動，指令寫進 README。
- CI：依 Infra 段落建一份最小 workflow（install → typecheck → lint → test → build）。
- 不建立任何雲端資源、不跑部署、不申請憑證。

### Step 5：驗證

依序跑安裝、`typecheck`、`lint`、`test`、`build`，全部要通過。失敗就修到過；修不掉時在最終報告裡如實寫出失敗指令與錯誤訊息，不要宣稱完成。

### Step 6：收尾

1. 把決策文件的「約束與慣例」寫進 `CLAUDE.md`（已存在就附加一段 `## 技術約束`，不覆蓋既有內容），並附上 `docs/architecture/tech-stack.md` 連結。
   有 App 時，**行動端本機開發預設平台與開發指令**也要進 `CLAUDE.md`（例如「行動端開發預設開 iOS 模擬器：`npx expo start --ios`」）——`/impl:feature` 每個 UI task 的驗收都要照它開來確認，寫在這裡它才不用每次去猜要開哪個平台。
   **UI 風格那一條一定要進 `CLAUDE.md`**（例如「UI 風格：calm-ui，全專案只用這一套」）。`tech-stack.md` 是它的決策來源，但 `CLAUDE.md` 每個 session 都會自動載入——寫在這裡，視覺語言 skill 被觸發之前答案就已經在 context 裡了。
2. 在對話中回報：建立了哪些目錄與檔案、跑過哪些驗證指令與結果、`.env` 需要填哪些 key、下一步建議（`/git:commit` 提交骨架、`/domain:business-rules` 開始定規則；有了 `docs/db/schema.md` 之後跑 `/arch:test-strategy` 定測試分層並建測試資料庫）。

## 參考

- `references/scaffold.md`：各技術棧的官方 scaffold 指令與 non-interactive 旗標、骨架後續調整要點。
