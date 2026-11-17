---
name: tech-stack
description: 用多輪問答為新專案選型 frontend、mobile、backend、database、infra 與架構模式，輸出 docs/architecture/tech-stack.md。當使用者開新專案不知道用什麼技術、想比較技術方案、或要求技術選型時使用。
---

# Tech Stack

透過結構化問答收集需求，依 `references/` 的判斷準則推薦技術棧，最後輸出決策文件。

## 前提：開發者是 AI agent

本 skill 假設程式碼由 AI agent 協作撰寫與維護，因此**不考慮**以下人類團隊因素，也不提問：

- 團隊規模、人數
- 團隊對語言 / 框架的熟悉度、學習成本
- 是否有專職 infra 人力

取而代之的判斷準則是「**AI agent 友善度**」與「**維運負擔**」：

| 準則 | 優先 | 降權 |
|---|---|---|
| 生態與訓練資料 | 主流、社群大、範例多的技術 | 冷門、小眾、僅少數人維護 |
| 文件與 API 穩定度 | 文件完整、API 長期穩定、有 LTS | 版本間 breaking change 頻繁、文件落後於實作 |
| 可驗證性 | 強型別、schema-first、成熟的測試與 lint 工具鏈 | 弱型別、難以自動化驗證 |
| 慣例明確度 | 有官方推薦的專案結構與最佳實務 | 高度自由、每個專案長得都不一樣 |
| 維運負擔 | 平台內建監控 / 備份 / 部署、零維運 managed 服務 | 需要持續人工介入的自架元件 |

同層候選在需求上難分高下時，以上表決勝；選到降權項目時在文件「風險 / 注意事項」寫明原因。

## 核心規則

1. **每一題都必須用 `AskUserQuestion` 提問，並提供 2–4 個選項。** 禁止用純文字開放式提問。工具內建「Other」讓使用者自訂答案，不需自行加「其他」選項。
2. **先問需求，不問技術。** 不要問「React 還是 Vue」，要問「需要 SEO 嗎」。技術由你依 references 推薦。
3. **選項要有 description**，說明選了會影響什麼（例如「需要 SEO → 傾向 SSR 框架」）。
4. 每輪最多 3 題，完整模式總題數控制在 12 題以內（含模式題與確認題），快速模式 5 題以內。
5. 若使用者在自訂答案中提到明確技術偏好（例如「我們只用 Go」），視為硬限制，後續不再推薦其他。
6. 推薦時**只從 references 的候選清單中選**；使用者有特殊需求超出清單時才用自身知識補充，並在文件中標注「非標準候選」。
7. 多選題若同時勾選「無…」與其他選項，忽略「無」，以其他選項為準；不需追問。
8. 答案互相衝突時（例如規模「中型商業應用」但預算「極低」），依 `references/scale.md` 的「衝突處理」原則決定，並在文件「需求回顧」中寫明取捨。

## 引用下游細節的寫法

決策文件可以引用下游的具體東西來支撐理由，但**優先引用能力**（「用到部分唯一索引、`NULLS NOT DISTINCT`」——schema 重構也不會變），少寫**識別名**（「掃 `idx_ai_invocations_deadline`」——改個索引名就過期）。非寫識別名不可時（排程要掃哪個索引、cron 對應哪張表），在該段落標一句「以 `docs/db/schema.md` 為準」。

下游改了不會有人回頭更新這份上游文件，它會安靜地過期；`/db:schema` 與 `/db:migrate` 的收尾會回頭掃過期引用，但源頭的寫法才是根本解。

## 流程

### Step 0：判斷模式

先用一題確認模式：

- **完整模式**：四輪問答（約 11–12 題），適合對外產品或中大型專案
- **快速模式**：使用者一句話描述專案 + 3 題關鍵問題，適合 MVP、side project、內部工具

若使用者一開始就給了詳細描述，可直接進快速模式並跳過已知的問題。

### Step 1：專案輪廓（2–3 題）

| 主題 | 選項方向 |
|---|---|
| 目標平台 | 只做 Web / Web + 行動 App / 只做行動 App / 純 API 無 UI |
| 產品類型 | 對外產品 / 內部工具 / 內容網站 / 電商・交易 |
| 預期規模 | 個人・小型 / 團隊・內部應用 / 中型商業應用 / 大型・企業級 |
| 大型系統特性（多選，僅規模選「大型」時） | 高流量 / 企業級治理 / 全球化・多區域 / 超大規模 |

規模題的選項文案與各檔位對各層的影響見 `references/scale.md`。

### Step 2：限制條件（2–3 題）

| 主題 | 選項方向 |
|---|---|
| 語言限制（多選） | 無限制、讓 skill 推薦 / TypeScript / Python / Go（Java・Kotlin 由 Other 填入） |
| Backend 語言（僅勾選 ≥ 2 個非 TS 語言時） | 從勾選的非 TS 語言中擇一 |
| TypeScript runtime（僅語言含 TS 或無限制時；雲平台指定 Cloudflare 時跳過，runtime 固定為 Workers） | 讓 skill 推薦 / Node.js / Bun |
| 雲平台或部署限制 | 無偏好 / AWS / GCP / Vercel・Cloudflare 類 PaaS / 必須自架 or 地端 |
| 專案架構模式 | 讓 skill 推薦 / Monorepo / 單一應用 / Polyrepo |
| 合規或預算 | 無特殊限制 / 資料需落地特定區域 / 預算極低（免費層優先） |

**語言限制的語意**：語言只是硬限制，不是熟悉度；使用者沒勾的語言不代表不能用，只是沒有偏好。無限制 → 依需求推薦，預設全端 TS；只勾 TS → 全端 TS；TS + 一個其他語言 → TS 負責 frontend / mobile，另一個負責 backend；勾了 ≥ 2 個非 TS 語言 → 追問一題 backend 用哪個；只勾非 TS 語言但有 Web / App → frontend 仍用 TS 框架（前提段已說明不計學習成本），並在「約束與慣例」寫明前後端語言分工。

### Step 3：功能需求（2–3 題，多選）

| 主題 | 選項方向 |
|---|---|
| Frontend 特性（有 Web 時） | 需要 SEO・SSR / 高互動 SPA / 大量表單・後台 / 幾乎無 UI |
| Mobile 特性（有 App 時） | iOS + Android 都要 / 只要單一平台 / 需要原生功能（相機・藍牙・背景定位）/ 需要離線 / 需要推播 |
| Backend 特性 | Real-time（WebSocket） / 背景任務・排程 / 重運算・AI 推論 / 檔案上傳處理 |
| UI 風格（有 Web 或 App 時，**每個介面各問一次**） | console・後台・內部系統（淺色、資訊密度高）/ 消費級 AI 產品（深色、Agent 主導）/ 已有設計系統 / 還沒決定 |
| 主要資料模型 | 關聯資料為主 / 簡單 CRUD・傳統 Web / 文件資料為主 / 混合・不確定 |
| 附加資料需求（多選） | Key-Value・Cache / 大量分析 / AI・Vector / 無 |

**條件式提問**：Step 1 目標平台若不含 Web，跳過 Frontend 特性題；不含 App，跳過 Mobile 特性題；兩者都不含（純 API / CLI / library）跳過 UI 風格題。

**UI 風格的落點**：風格跟著**介面**走，不跟著專案走。先列出專案有哪些有畫面的介面——Step 1 的 Web / App，加上需求裡的 console・後台（有管理者或營運人員要操作就有）——每個介面選一套。預設推薦：console・後台 → `/ui:tonal-ui`；使用者端 Web 與行動 App → `/ui:calm-ui`（使用者端 Web 本身就是後台型工具時才改）。**同一個介面內兩套互斥、不可混用**；不同介面各用一套是正常的。這題要在文件裡寫成「介面路徑 → 風格」的對照——沒寫的話每個 session 都要重猜，而猜錯的那一次會產出一個跟同介面既有畫面不同語言的元件；只寫一句全專案風格，console 會被做成深色消費級、或 web 被做成後台。已有設計系統 → 寫明位置，該介面兩套都不套用。還沒決定 → 寫「未決」並列進「未決事項」，不要先挑一個。

### Step 4：初版推薦與確認（1–2 題）

1. 在對話中列出各層初版推薦（一張表：層級 / 選擇 / 一句理由）。層級為 架構模式 / Frontend / (Mobile) / Backend / Database / Infra。
2. 用 `AskUserQuestion` 問「是否有哪一層要調整」，選項固定為「都接受」「架構 / Frontend / Mobile」「Backend / Database」「Infra」，選中後再細問哪一層。
3. 若有調整，針對該層再提供 2–3 個替代選項（來自 references 的「替代」欄），確認後結束。

### Step 5：輸出文件

寫入 `docs/architecture/tech-stack.md`。若檔案已存在，先用 `AskUserQuestion` 確認「覆蓋 / 另存為 `docs/architecture/tech-stack-YYYY-MM-DD.md`」。

文件格式照 `references/template.md`（寫文件前讀）。

**架構模式與當前目錄的關係**（寫在「專案架構」）：

- 單一應用 / Monorepo：當前目錄就是該 repo，骨架直接畫在此目錄下。
- Polyrepo：當前目錄是**其中一個 repo**（通常是主要服務，依產品類型決定：Web 產品 → web、純 API → api）。「專案架構」改列「Repo 清單」表（repo 名稱 / 技術 / 負責範圍），其餘 repo 放進「未決事項」。若使用者希望當前目錄當作 workspace 父目錄，改用 Monorepo 較合理，需在對話中提醒。

「約束與慣例」除了技術規則，也要寫明給 AI agent 遵守的驗證要求：型別檢查、lint、測試指令，以及 schema / API 契約的單一來源（zod、OpenAPI、Prisma schema 等）。

輸出後在對話中簡短摘要，並建議使用者把「約束與慣例」段落複製到 `CLAUDE.md`（若專案有的話）；要改某一層可再呼叫 `/arch:tech-stack` 重跑。

### Step 6：交棒給初始化

文件寫完後，在摘要末尾告訴使用者：**接著可以呼叫 `/arch:init` 依這份文件建立專案骨架**（目錄結構、scaffold 指令、lint / test 設定、`.env.example`）。本 skill 只負責決策與文件，不動專案檔案。

## 判斷準則

各層候選與情境對應表見：

- `references/scale.md`（規模檔位 → 各層傾向，每次都讀）
- `references/architecture.md`（repo 結構與服務拓撲）
- `references/frontend.md`
- `references/mobile.md`（目標平台含 App 時）
- `references/backend.md`
- `references/database.md`
- `references/infra.md`

推薦前**務必讀取對應 reference**，不要憑印象推薦。
