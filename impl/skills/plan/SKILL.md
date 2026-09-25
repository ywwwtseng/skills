---
name: plan
description: 把一個 feature 的 business rules、domain model 與 db schema 切成可獨立驗證、可續跑的實作 task 清單，輸出 docs/impl/<feature>/plan.md——每個 task 帶追溯 ID、會動到的檔案、前置依賴、驗收指令與狀態，檔案本身自帶執行協議，讓被壓縮或跨 session 的 agent 只讀這一份檔案就能接手。當使用者說「規劃實作」「把 feature 切成 task」「排實作順序」「開始寫 code 前先列步驟」「要讓 agent 自己 long-running 跑完」時使用。本 skill 不寫任何產品程式碼；實作由 /impl:feature 依 plan.md 逐個 task 執行。
---

# Impl Plan

把設計文件切成一串「一個 context window 做得完、做完就能驗證、驗證過就能 commit」的 task，並把狀態落在檔案裡，讓實作可以被中斷、被壓縮、跨 session 續跑。

## 定位：設計文件與程式碼之間的那一層

- **輸入**：`docs/domain/business-rules/<feature>.md`（要做什麼、每條規則的驗收）、`docs/domain/model/`（概念與不變量）、`docs/db/schema.md`（table 與落點）、`docs/api/contract.md`（端點與錯誤碼，存在的話）、`docs/ui/screens/`（畫面與狀態，存在的話）、`docs/architecture/tech-stack.md`（技術選擇、約束與慣例、驗證指令），以及**既有程式碼**（目錄結構、既有 feature 的實作與測試慣例）。
- **輸出**：單一檔案 `docs/impl/<feature>/plan.md`。一個 feature 一份；跨 feature 不合併，因為 plan 的生命週期到這個 feature 做完為止。
- **不做**：寫產品程式碼、改上游文件、下 git 指令。本 skill 只產出 task 清單與執行協議，實作交給 `/impl:feature`，提交交給 `/git:commit`。

上游文件回答「要做成什麼樣」；plan 回答「照什麼順序做、每一步做完怎麼知道對了、中斷後從哪裡接」。分開的意義是：agent 的記憶會被壓縮，但檔案不會。

## 核心規則

1. **plan.md 是 long-running 的唯一狀態來源。** 進度、決策、卡關原因一律寫進檔案，不要只留在對話裡。驗收標準很簡單：一個**完全沒有上下文**的新 session，只讀 `plan.md` 就要能正確接手下一個 task。做不到就是這份 plan 沒寫好。
2. **plan.md 必須自帶執行協議。** 檔案開頭要包含「執行協議」段（見下方模板），寫死 task 狀態怎麼流轉、驗收沒過怎麼辦、什麼時候 commit。不能假設接手的 agent 有載入本 skill。
3. **每個 task 都要可獨立驗證。** 必須寫得出一條**可以現在就跑的指令**（`pnpm test order.status`、`pnpm typecheck`），跑完能判斷成功失敗。寫不出驗收指令的不是 task，是願望——拆到寫得出來為止。「實作訂單模組」不是 task，「Order 狀態轉換 + 對應單元測試」才是。
4. **每個 task 一個 context window 做得完。** 經驗法則：會動到的檔案 ≤ 5 個、預估 diff ≤ 300 行、驗收指令 ≤ 1 條主要指令。任一項超過就再切。切太細（改一行一個 task）同樣不行，會讓執行序被雜訊淹沒。
5. **垂直切片優先於水平分層。** 不要排成「先做完所有 model → 再做完所有 API → 最後做 UI」；那種順序中間每一刻系統都是壞的，中斷就等於全毀。改成每個 task 完成後**系統仍可跑、既有測試仍全綠**。第一個 task 固定是最小可跑的貫穿切片（walking skeleton）：一條路徑從入口到資料庫走通，其餘規則後續 task 補。
6. **依賴顯式，執行序線性。** 每個 task 寫 `前置`，形成 DAG；輸出時要另外給一份**線性執行序**（拓撲排序後的順序），因為 long-running 的 agent 需要的是「下一個做哪個」而不是一張圖。可平行的 task 標出來，但預設序列執行。
7. **追溯不中斷。** 每個 task 的「來源」指回 `BR-ID`、模型元素（`order.md#Order.status`）或 schema table，沿用上游的 ID 格式。反過來，feature 的每條 BR 都要能在某個 task 的來源裡找到；找不到的列進「未覆蓋規則」並寫原因，不默默略過。
8. **不改上游文件。** 拆 task 時發現規則有矛盾、模型缺概念、schema 少欄位，照「上游回饋」表的格式新增一列（狀態 `待處理`）並在摘要提出，交給 `/domain:feedback` 分類與路由。不要在 plan 裡自己補一條規則，那條規則不會有人知道。
9. **驗證指令來自專案，不是憑空寫。** 從 `docs/architecture/tech-stack.md` 的「約束與慣例」、`package.json` scripts、CI workflow 抓實際存在的指令。抓不到就在 Step 0 問，不要寫一個跑不起來的 `npm test`。
10. **提問必須用 `AskUserQuestion`，一次只問一題。** 只問「不同答案會產生不同 task 切法或不同順序」的問題（要不要先做 happy path 再補例外、某段要不要獨立成一個 task）。命名、檔案放哪這類實作時再決定就好的事不要問，標「假設」直接寫。

## 流程

### Step 0：確認範圍、讀上游、盤點現況

1. **確認是哪個 feature。** 使用者沒指定時，列出 `docs/domain/business-rules/` 下的檔案讓他選（`AskUserQuestion`）。一次只規劃一個 feature。
2. **檢查續跑。** `docs/impl/<feature>/plan.md` 已存在 → 進入 Step 6 的續跑模式，不要重寫整份（跳過下一步，你應該已經在這個 feature 的分支上）。
3. **確認起點分支**（只有全新 feature 才做）。規劃一個新 feature 前，工作區要乾淨、而且要站在 base branch 上：
   - 當前在別的 feature 分支上，**且**那個 feature 已經開過 PR（`gh pr view` 查得到）→ `git switch <base>` 並 `git pull --ff-only`，從乾淨的起點開始。
   - 當前在別的 feature 分支上，但**還沒開 PR**（上一個 feature 做到一半被打斷）→ 停下來問要先做完它還是擱置，不要默默切走。
   - 工作區有未提交的變更 → 停下來，建議先跑 `/git:commit`。

   漏掉這一步，新 feature 的 commit 會疊在上一個 feature 的分支上，最後被捲進上一個 PR。無人看守時沒有人會發現。
4. **讀上游，缺什麼就停。** 沒有 `docs/domain/business-rules/<feature>.md` 時不要憑一句話排 task——說明需要先有規則，建議先跑 `/domain:business-rules`，然後停止。模型或 schema 缺席時可以繼續（有些 feature 不碰資料庫），但要在 plan 的「上游狀態」記明是在缺什麼的情況下排的。
   有客戶端要呼叫這個 feature（web / 行動端 / 第三方）卻沒有 `docs/api/contract.md` 時，**不要自己發明端點與錯誤碼**——伺服器端與客戶端的 task 會各自發明一份，而且兩邊測試都會綠。建議先跑 `/api:contract`，然後停止。
   這個 feature 有畫面卻沒有 `docs/ui/screens/` 時同理：UI task 的驗收會寫不出來（只能寫「開起來看看」），空狀態與錯誤呈現會由每個 task 各自發明。建議先跑 `/ui:screens`。
5. **抓驗證指令**（核心規則 9）：typecheck、lint、test（含只跑單一檔案的寫法）、build、dev。記下來，Step 3 每個 task 都要從這組指令挑。
   有 `docs/architecture/testing.md` 時一併讀它的指令表與分層對照——Step 3 每個 task 該寫哪一層測試、跑哪一條指令，照那張表決定。
6. **盤點既有程式碼**：目錄結構、既有相似 feature 怎麼分層、測試放哪裡怎麼命名、有沒有現成可複用的東西。plan 的 task 要長得像這個 repo 既有的樣子，不是像教科書。

### Step 1：切片策略

先決定整體怎麼切，再切 task。依序決定：

1. **貫穿切片是什麼**：挑 business rules 裡最核心的那條 happy path，定義成 T-001（核心規則 5）。
2. **後續切片依什麼分**：預設依**業務規則群組**分（一組相關的 BR 一個 task），不是依技術層分。狀態機類的 feature 依「狀態轉換」分；CRUD 類的依「命令」分（建立 / 修改 / 取消各一個）。
3. **例外與邊界何時做**：預設 happy path 的 task 完成後，緊接著補它的例外分支，不要把所有例外堆到最後——堆到最後的東西在 long-running 裡最容易被截斷。
4. **哪些不在這次範圍**：明確列「不做」，避免 agent 在跑的時候自行擴張。

### Step 2：定義 task

逐個寫出 task，每個包含這些欄位（缺一不可）：

| 欄位 | 說明 |
|---|---|
| ID | `T-001` 起，三位數，永不重編（續跑時新增的往後接） |
| 標題 | 一句話，動詞開頭，說明產出什麼 |
| 來源 | 追溯：`BR-order-012`、`order.md#Order.status`、`schema.md#orders`、`contract.md#POST /orders/{id}/cancel`（核心規則 7） |
| 動到 | 預估會建立 / 修改的檔案路徑（≤ 5，核心規則 4）。是預估，執行時不符要在備註更正 |
| 前置 | 依賴的 task ID，無則寫「無」 |
| 驗收 | 一條可以現在就跑的指令 + 一句「看到什麼算過」 |
| 狀態 | `todo` / `doing` / `done` / `blocked`，初始一律 `todo` |
| 備註 | 初始留空。執行時寫：卡在哪、試過什麼、跟預估差在哪 |

**自我檢查**：每寫完一個 task 問自己「一個沒有上下文的 agent 拿到這幾行，做得出來嗎」。答案是否的話，缺的資訊補進「來源」或「備註」，不要寄望它會自己去翻。

### Step 3：驗收指令

逐個 task 把驗收寫具體，只能從 Step 0 抓到的指令組合：

- 有測試的 task → 跑該測試檔（`pnpm test src/domain/order.test.ts`），並在「看到什麼算過」寫明要新增哪幾個測試案例（直接取自 BR 的「輸入 → 預期結果」）。
- 測試層照 `docs/architecture/testing.md` 的分層對照：落點是 DB 約束的不變量、權限、契約錯誤碼，驗收要跑整合 / API 層的指令（`pnpm test:integration tests/integration/order.test.ts`），不要寫成 mock 掉資料庫的單元測試。沒有 `testing.md` 時照既有慣例，並在「上游狀態」記明。
- 純型別 / 設定類的 task → `pnpm typecheck` 或 `pnpm build`。
- UI task → 除了 typecheck，寫明用 `/run` 開起來要看到什麼畫面；有 `docs/ui/screens/` 時，驗收直接引用規格的狀態（「在空狀態顯示 X、在離線顯示 Y」），不要只寫「畫面正常」。
- 行動端的 UI task → **驗收指令寫成開 iOS 模擬器的那一條**（`npx expo start --ios`、`flutter run -d ios`……，以 `docs/architecture/tech-stack.md` 的「約束與慣例」為準）。不要寫成 `npx expo start` 讓執行的 agent 自己選平台——它會選到沒裝模擬器的那一個然後卡住。Android 專屬的行為（返回鍵、權限對話框差異）才另外開一個 task 標明要用 Android 驗。
- **每個 task 的驗收都隱含包含「既有測試不能壞」**，這條寫在執行協議裡，不用每個 task 重複。

### Step 4：排序

1. 依「前置」做拓撲排序，產出線性執行序（`T-001 → T-003 → T-002 → …`）。
2. 檢查排序後**每個位置系統都是可跑的**（核心規則 5）。有位置會讓既有測試變紅，調整順序或把 task 再切。
3. 標出可平行的 task（無依賴關係、不動到同一個檔案），但執行序仍給一條線。
4. 把風險高的往前挪：不確定能不能做、需要外部服務、可能推翻設計的，優先做——早失敗比晚失敗便宜。

### Step 5：釐清（有切法歧義才做）

只挑同時符合以下條件的問題：

- 不同選擇會產生**不同的 task 切法或不同執行序**，不只是實作細節
- 從上游文件與既有程式碼**推不出**明顯較合理的一邊
- 選錯會讓已經做完的 task **要重做**（不是加一個 task 就好）

依重做成本排序，一題一題用 `AskUserQuestion` 問。每題：`options` 2–4 個，第一個標「(Recommended)」；`description` 格式為「切法：〈會變成幾個 task、順序長怎樣〉／影響：〈中斷時的風險、之後要改的代價〉」。

### Step 6：輸出 plan.md

寫入 `docs/impl/<feature>/plan.md`，模板見下方。

**續跑模式**（檔案已存在）：不重寫整份，只做增量——

1. 先讀完整份，特別是 `done` 的 task 與所有「備註」，那是上次的記憶。
2. 上游文件若在這之後改過（比對「上游狀態」記的版本或日期），列出受影響的 task：`done` 的可能要重做（標回 `todo` 並在備註寫原因），`todo` 的直接改內容。
3. `blocked` 的 task 逐個處理：問題解了就轉回 `todo`，沒解就確認備註寫清楚卡點。
4. 新增的 task 往後接號，不插隊、不重編。
5. 變動記進「變更紀錄」。

### Step 7：收尾

在對話中：

1. 列出寫入 / 修改的檔案
2. 摘要：task 總數、線性執行序、預估會動到的檔案數、風險最高的 task 是哪個
3. 覆蓋率：feature 的 BR 共 N 條，被 task 覆蓋 M 條，未覆蓋 K 條（逐條列出原因）
4. 列出最值得確認的 3 個切法假設
5. 列出「上游回饋」（規則 / 模型 / schema 的矛盾或缺口，若有），建議跑 `/domain:feedback` 處理
6. 下一步：`/impl:feature` 從 `T-001` 開始執行；要讓它自己連續跑，用 `/loop`（不給 interval，讓它自己抓節奏），每個 task 結束由 `/git:commit` 建立還原點；全部 task 做完由 `/impl:verify` 稽核、`/git:pr` 開 PR

## 與 /impl:feature 的協議

這段定義 plan.md 被**消費**的方式，必須原樣寫進每份 plan.md 的「執行協議」段（核心規則 2）：

1. **接手**：讀 plan.md → 找執行序上第一個非 `done` 的 task。有 `blocked` 擋在前面且未解，先處理它，不要跳過去做後面的。狀態是 `doing` 表示上一輪被中斷：先看 `git status` 有沒有未提交的產出，據此判斷接續還是重來；判斷不出來就問使用者，不要自行丟棄。
2. **開工**：把狀態改成 `doing` 並存檔，再開始寫程式。這樣中途被中斷，下一個 session 知道這個 task 做到一半。
3. **只做這一個 task**。看到順手可以改的其他東西，寫進備註或新增 task，不要順手改——順手改會讓這次 commit 不可回溯。
4. **驗收**：跑該 task 的驗收指令，**外加**既有測試不能壞。沒過就修；修不掉改成 `blocked`，在備註寫「卡在哪、試過什麼、需要什麼才能解」，然後停下來問使用者，不要硬幹也不要跳下一個。
5. **標記**：驗收過了才改成 `done`。「動到」與預估不符時在備註更正，這是給後續 task 的情報。
6. **commit**：呼叫 `/git:commit`，commit message 的 scope 或 body 帶上 task ID（`feat(order): 加入狀態轉換 (T-003)`）。程式碼與 plan.md 的狀態更新放在**同一個 commit**，狀態與產出要一起前進。commit 完才算這個 task 結束，才可以開始下一個。
7. **不改 plan 以外的規劃決策**：發現整個切法錯了，停下來說明並建議重跑 `/impl:plan`，不要邊做邊改執行序。

## 輸出模板

````markdown
# <Feature 名稱> 實作計畫

> 狀態：規劃中 / 執行中 / 完成　|　最後更新：<YYYY-MM-DD>
> 進度：<done 數> / <總數>

## 執行協議

<原樣抄上方「與 /impl:feature 的協議」7 條。接手的 agent 可能沒載入任何 skill，這段是它唯一的操作說明。>

驗證指令：

| 用途 | 指令 |
|---|---|
| 型別檢查 | `pnpm typecheck` |
| Lint | `pnpm lint` |
| 全部測試 | `pnpm test` |
| 單一測試 | `pnpm test <path>` |
| Build | `pnpm build` |

## 目標與範圍

- **目標**：<一句話，這個 feature 做完使用者能做到什麼>
- **做**：<條列>
- **不做**：<條列，明確排除，避免執行時擴張>

## 上游狀態

| 文件 | 路徑 | 最後更新 | 備註 |
|---|---|---|---|
| Business rules | `docs/domain/business-rules/<feature>.md` | <日期> | 共 N 條 BR |
| Domain model | `docs/domain/model/<聚合>.md` | <日期> | |
| DB schema | `docs/db/schema.md` | <日期> | 相關 table：<列出> |

## 切片策略

<2–4 句：怎麼切、為什麼這樣切、貫穿切片是哪個 task。>

## 執行序

`T-001 → T-002 → T-004 → T-003 → …`

可平行：<T-00X 與 T-00Y（不動到同一批檔案）>

## Tasks

### T-001 <標題>

- **來源**：<BR-ID / 模型元素 / schema table>
- **動到**：`<path>`、`<path>`
- **前置**：無
- **驗收**：`pnpm test src/domain/order.test.ts`　→ 新增的 3 個案例（BR-order-012 的三條輸入 → 預期結果）全綠，既有測試不變紅
- **狀態**：todo
- **備註**：

### T-002 <標題>

<同上>

## 規則覆蓋

| BR-ID | 規則摘要 | 由哪個 task 覆蓋 |
|---|---|---|
| BR-order-012 | <摘要> | T-001、T-003 |
| BR-order-018 | <摘要> | **未覆蓋** — <原因> |

## 風險與假設

| # | 假設 / 風險 | 影響的 task | 錯了要付什麼代價 |
|---|---|---|---|

## 上游回饋

| # | 類型 | 問題 | 發現於 | 狀態 | 處理結果 |
|---|---|---|---|---|---|
| F-001 | <規則矛盾 / 規則缺漏 / 模型缺概念 / schema 缺欄位或落點錯 / 誤報> | <一句話> | <T-00X> | 待處理 | |

<沒有就整張表留空。只新增「待處理」的列，不要在這裡自行補規則；狀態與處理結果由 `/domain:feedback` 維護。>

## 變更紀錄

| 日期 | 變動 |
|---|---|
| <YYYY-MM-DD> | 初版，N 個 task |
````
