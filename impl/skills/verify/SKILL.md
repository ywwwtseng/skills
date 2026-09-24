---
name: verify
description: 在開 PR 之前把一個 feature 的實作從頭核對一遍——plan.md 的 task 是否真的做完、每條 business rule 是否真的有測試在驗它、schema 的不變量落點是否真的落地、全套驗證指令是否真的綠、有沒有為了讓測試過而動手腳或悄悄擴張範圍——輸出 docs/impl/<feature>/verification.md，並把每個缺口寫成新 task 接回 plan.md。當使用者說「驗收這個 feature」「做完了嗎」「檢查有沒有漏」「開 PR 前確認一下」「跑一次品質閘門」，或 /impl:feature 報告全部 task done 時使用。本 skill 只稽核與回報，不改任何產品程式碼與測試；修補交給 /impl:feature 或 /impl:fix。
---

# Impl Verify

`/impl:feature` 保證「每個 task 的驗收指令綠」。本 skill 回答的是另一個問題：**這個 feature 真的做完了嗎**——規則有沒有漏、測試是不是真的在驗規則、有沒有多做了不該做的事。

無人看守時，這是唯一一道有人在看的關卡。

## 定位：實作與 PR 之間的閘門

- **輸入**：`docs/impl/<feature>/plan.md`（task 狀態、規則覆蓋表、備註、上游回饋）、`docs/domain/business-rules/<feature>.md`（每條 BR 的輸入 → 預期結果）、`docs/domain/model/`（不變量、狀態機）、`docs/api/contract.md`（端點與錯誤碼，存在的話）、`docs/ui/screens/`（畫面狀態與錯誤行為，存在的話）、`docs/db/schema.md`（不變量落點表）、以及**實際的程式碼、測試與 git 紀錄**。
- **輸出**：`docs/impl/<feature>/verification.md`（一份有明確 verdict 的稽核報告）、回寫 `plan.md`（把缺口變成新 task）。
- **不做**：改產品程式碼、改測試、改上游文件、下 git 指令、開 PR。發現問題就記錄並轉成 task，修補交給 `/impl:feature`（缺工作）或 `/impl:fix`（有缺陷）。

分開的意義是：寫程式的人（或 agent）不能同時當驗收的人。`/impl:feature` 每個 task 都只看得到自己那一小塊，**沒有任何一步會回頭問「整個 feature 的規則都覆蓋了嗎」**。

## 核心規則

1. **只稽核，不修。** 看到一行就能補的測試、一個明顯的 typo、一個少掉的斷言，都不要順手改。順手改會讓稽核者與被稽核者變成同一個人，這份報告就失去意義了。寫進報告，轉成 task。
2. **每個結論都要有證據。** 「BR-order-012 有覆蓋」不算結論，「BR-order-012 → `src/domain/order.test.ts:47` 斷言 `status` 從 `paid` 轉 `shipped` 會成功、`:58` 斷言從 `cancelled` 轉 `shipped` 會丟 `InvalidTransition`」才算。找不到證據就是 `未覆蓋`，不要因為「應該有做吧」就放過。
3. **指令要真的跑過。** 驗證結果一律來自這次實際執行的輸出，不採信 plan.md 上寫的「已通過」，也不採信上一輪的記憶。貼出指令與結果摘要。
4. **verdict 只有三種，而且要敢給 `fail`。** `pass` / `pass with findings` / `fail`。有任何一條 BR 完全沒實作、任何驗證指令是紅的、或發現測試被動過手腳 → `fail`。無人看守的流程裡，一個軟掉的閘門等於沒有閘門。
5. **缺口要變成可執行的 task，不能只是抱怨。** 每個 `fail` / `findings` 都要在 `plan.md` 末尾接一個新 task（往後接號、不插隊、不重編），帶來源、動到、驗收——這樣 `/loop /impl:feature` 會自動去補。只寫在報告裡的缺口，無人看守時等於不存在。
6. **不改變規則的定義。** 發現 BR 本身有矛盾或做不到，寫進報告的「上游回饋」並照格式同步進 plan 的「上游回饋」表（狀態 `待處理`），交給 `/domain:feedback`。不要在報告裡自行裁定規則應該是什麼。
7. **範圍也要驗。** 少做要抓，多做一樣要抓。plan 寫「不做」的東西出現在 diff 裡，是這次實作該被退回的理由之一。
8. **提問必須用 `AskUserQuestion`，一次只問一題。** 只在「判不出是缺陷還是刻意為之」時問（某條規則的測試明顯被放寬、某個檔案的改動看不出屬於哪個 task）。其餘一律照證據下判斷並記錄理由。

## 流程

### Step 0：定位與盤點

1. **找 feature**：使用者指定 > `docs/impl/` 下唯一一份 > 多份用 `AskUserQuestion` 問。沒有 plan.md 就停，說明需要先有計畫。
2. **完整讀 plan.md**：task 狀態、規則覆蓋表、所有備註、上游回饋、變更紀錄。備註裡「動到與預估不符」「多動了什麼」是後面查範圍外洩的線索。
3. **抓驗證指令**：plan 的驗證指令表 >「約束與慣例」> `package.json` scripts / CI workflow。
4. **抓 diff 範圍**：`git log` 找出這個 feature 的 commit（message 帶 task ID），`git diff <base>...HEAD --stat` 拿到實際動過的檔案清單。這份清單是後面每一項檢查的比對基準。

### Step 1：執行完整性

對照 plan 的 task 清單：

| 檢查 | 判定 |
|---|---|
| 有 `todo` / `doing` / `blocked` 的 task | 未完成，列出 ID 與狀態；`blocked` 要摘錄卡點 |
| 有 task 標 `done` 但找不到對應 commit | **可疑**，列為 finding，要查它的產出是否真的存在 |
| 有 commit 帶的 task ID 不在 plan 裡 | 範圍外的工作，列為 finding |

### Step 2：規則覆蓋（本 skill 的核心）

逐條走 `docs/domain/business-rules/<feature>.md` 的 BR，**一條都不能跳**。對每一條：

1. 在測試檔裡找 BR-ID（`grep -rn "BR-order-012"`）。`/impl:feature` 要求斷言帶 BR-ID，所以找不到 ID 是第一個警訊。
2. 找到了就**打開來看斷言內容**，比對 BR 寫的「輸入 → 預期結果」，包含它列出的邊界與例外分支。ID 出現在註解裡但斷言只驗了 happy path，算 `部分覆蓋`。
3. 找不到 ID 就用規則的語意去找（相關函式名、錯誤型別）。找得到實作但沒有測試 → `有實作無測試`。
4. 都找不到 → `未覆蓋`。

輸出成表，每列一條 BR，帶證據路徑與行號。狀態只有四種：`完整覆蓋` / `部分覆蓋` / `有實作無測試` / `未覆蓋`。

plan 的規則覆蓋表寫「未覆蓋 — <原因>」的，確認那個原因現在還成立（例如「留到下一個 feature」）；不成立就是 finding。

### Step 3：不變量落點

翻 `docs/db/schema.md` 的不變量落點表，逐條確認：

- 落點是 **DB 約束** → 對應的 migration / schema 檔裡真的有那條 `UNIQUE`、`CHECK`、`NOT NULL`、外鍵。沒有就是 finding（文件說 DB 會擋，實際上沒擋）。
- 落點是 **應用層** → 程式碼裡真的有實作，而且有測試驗它會擋。兩邊都要有。
- 兩邊都實作了 → 記為 finding（重複實作，之後會不一致），但嚴重度低。

`docs/domain/model/` 裡的狀態機：每個**非法轉換**是否有測試驗它被拒絕。只測合法路徑不算覆蓋。

有 `docs/api/contract.md` 時再走一次錯誤碼：契約上每個錯誤碼，程式碼裡真的會在那個情境回出來嗎、有沒有測試驗它？以及反過來——每條 BR 的失敗情境是否都能對到一個實際會被回出來的錯誤碼。契約寫了、程式沒回，客戶端會收到一個它沒有處理分支的錯誤。

有 `docs/ui/screens/` 時走畫面狀態：規格寫明的每個狀態（空、錯誤、權限不足、離線、送出失敗）在程式碼裡真的有對應分支嗎。只實作 happy path 的畫面，在 demo 時看起來是好的。

### Step 4：跑全套驗證

實際執行（核心規則 3）：type check、lint、全部測試、build。UI 類的 feature 依 plan 的驗收描述用 `/run` 開起來確認；行動端預設開 iOS 模擬器（指令見 `CLAUDE.md` 或 tech-stack 的「約束與慣例」）。開不起來就是 `fail`——「程式碼看起來對」不算驗過。

逐條記下指令與結果。任何一條紅 → verdict 直接是 `fail`，附上失敗輸出。

### Step 5：測試誠信抽查

無人看守時最常見、也最難發現的失敗模式是「為了讓它綠」。掃這些訊號：

| 訊號 | 怎麼查 |
|---|---|
| 被跳過的測試 | `grep -rn "\.skip\|\.only\|xit(\|xdescribe(\|@Ignore\|t.Skip"` 測試目錄 |
| 恆真斷言 | `expect(true).toBe(true)`、`assert(1 == 1)`、沒有任何 `expect` 的測試 |
| 斷言被改成實際輸出 | `git log -p` 看這批 commit 有沒有改到**既有**測試的預期值；有就逐個確認理由 |
| BR 被悄悄改過 | `git log --oneline <base>..HEAD -- docs/domain/` 應該是空的（`/impl:feature` 禁止改上游文件） |
| 測試沒有真的跑到 | 測試數量是否隨這次實作增加；一個新 task 帶 0 個新測試是警訊 |

找到任何一項 → verdict `fail`，並在報告寫清楚是哪個 commit、哪一行。

### Step 6：範圍與衛生

比對 Step 0 的 diff 清單：

- 有沒有檔案落在 plan「不做」的範圍裡
- 有沒有 commit 混進與 task 無關的變更（還原點失效）
- 有沒有 `.env`、金鑰、憑證、build 產物被提交
- 有沒有 debug 殘留：臨時 `console.log`、被註解掉的程式碼、`TODO: remove`
- 有沒有引入 plan 與 `docs/architecture/tech-stack.md` 都沒寫的新依賴（查 lockfile diff）

### Step 7：回寫

1. 寫入 `docs/impl/<feature>/verification.md`（模板見下）。
2. 回寫 `plan.md`：
   - 每個缺口接一個新 task（核心規則 5），來源指回那條 BR / 不變量，驗收寫得出可跑的指令
   - 更新規則覆蓋表為這次查到的實況
   - 新發現的上游問題照格式補進「上游回饋」表（狀態 `待處理`）
   - 變更紀錄加一列
3. **不要**把 verdict 寫成 `pass` 之後才去補 task；先補 task，再定 verdict。

### Step 8：收尾

在對話中：

1. **verdict**（`pass` / `pass with findings` / `fail`）與一句話理由
2. 規則覆蓋：共 N 條，完整覆蓋 M 條，部分 / 無測試 / 未覆蓋各幾條（逐條列出後三類）
3. 驗證指令結果（失敗的附輸出）
4. findings 依嚴重度排序，每個帶證據路徑
5. 新增到 plan 的 task ID 與標題
6. 下一步：
   - `pass` → `/git:pr` 開 PR
   - `pass with findings` → 可以開 draft PR，或先跑 `/impl:feature` 補新增的 task
   - `fail` → `/impl:feature` 補 task（缺工作）或 `/impl:fix`（有缺陷），修完重跑 `/impl:verify`

## 輸出模板

````markdown
# <Feature 名稱> 驗收報告

> Verdict：**pass / pass with findings / fail**　|　驗收時間：<YYYY-MM-DD>
> 對象：`docs/impl/<feature>/plan.md`（進度 <done>/<總數>）　|　比對基準：`<base>...<HEAD 短 hash>`

## 結論

<2–4 句：做完了沒、可不可以開 PR、最該處理的是什麼。>

## 執行完整性

| Task | 狀態 | Commit | 備註 |
|---|---|---|---|

## 規則覆蓋

| BR-ID | 規則摘要 | 狀態 | 證據 |
|---|---|---|---|
| BR-order-012 | <摘要> | 完整覆蓋 | `src/domain/order.test.ts:47,58` |
| BR-order-018 | <摘要> | 未覆蓋 | 測試與程式碼都找不到 |

共 N 條：完整覆蓋 M｜部分覆蓋 X｜有實作無測試 Y｜未覆蓋 Z

## 不變量落點

| 不變量 | 文件落點 | 實際 | 證據 |
|---|---|---|---|

## 驗證指令

| 指令 | 結果 | 備註 |
|---|---|---|

## Findings

| # | 嚴重度 | 問題 | 證據 | 處理方式 |
|---|---|---|---|---|
| 1 | high | <一句話> | `<path>:<line>` / `<commit>` | 已新增 T-0XX / 建議 `/impl:fix` |

嚴重度：`high`（規則沒被實現、測試被動過手腳、驗證紅）／`medium`（有實作無測試、不變量沒落地）／`low`（重複實作、debug 殘留、文件不同步）

`low` 的處理方式一律是「交給 `/impl:refactor`」而不是新增 task——它們不影響這個 feature 是否做完，不該擋住 PR。

## 範圍

- 動到的檔案：N 個
- 落在「不做」範圍的變更：<列出或「無」>
- 新增依賴：<列出或「無」>

## 上游回饋

| # | 類型 | 問題 | 發現於 | 狀態 |
|---|---|---|---|---|
| F-00X | <類型> | <一句話> | <finding # / BR-ID> | 待處理 |

<同步一份到 plan.md 的「上游回饋」表，交給 `/domain:feedback`；沒有就整張表留空。不要在這裡裁定規則應該是什麼。>

## 新增的 task

| Task | 標題 | 對應 finding |
|---|---|---|
````

## 常見失敗模式

| 症狀 | 為什麼是錯的 |
|---|---|
| 看到測試全綠就給 `pass` | 綠只證明寫出來的測試過了，不證明規則有被測（Step 2 才是重點） |
| 稽核時順手把缺的測試補上 | 寫的人與驗的人變成同一個，報告失去意義（核心規則 1） |
| 缺口只寫在報告裡，沒進 plan | 無人看守時沒有人會讀報告，缺口等於不存在（核心規則 5） |
| 「BR-012 應該有覆蓋」沒附行號 | 沒有證據的結論下次還要再查一遍（核心規則 2） |
| 只抽查幾條 BR 就下結論 | 沒被抽到的那條就是會上線的那條；規則要逐條走完 |
| 發現測試被改成實際輸出，記成 low | 那是整份實作最嚴重的問題，直接 `fail`（Step 5） |
| 採信 plan.md 上的「已通過」 | 那是上一輪寫的，不是這一輪跑的（核心規則 3） |
