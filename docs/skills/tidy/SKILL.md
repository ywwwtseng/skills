---
name: tidy
description: 替專案的 docs/ 瘦身，但不改寫任何規則的語意——三件事：(1) 做完的東西：已合併 feature 的 plan.md 把 done 的 task 收成一行（保留來源與 commit，/domain:feedback 的漣漪仍追得到），verification.md、已處理的債與舊的 audit 報告移到 docs/archive/，移走前先把還沒被消費的備註與 low findings 收進 debt.md；(2) 互相複製：被整段貼到下游文件的規則、模型、table 內文改回引用 ID，原文只留在擁有它的那份文件；(3) 過時內容：懸空引用、孤兒元素、內容已分岔的複本、「以前是這樣」的段落列成清單一次問完，裁定後上游文件交回各自的 skill 改。每一類一個 commit。只由使用者以 /docs:tidy 手動執行，不會被自動觸發。本 skill 不改規則內容、不改產品程式碼、不碰還在進行中的 feature。
disable-model-invocation: true
---

# Docs Tidy

docs 會長大，是因為每個 skill 都只往裡面加東西：plan 的 task 做完了還留著完整的動到與驗收、verification 一份份疊上去、規則被複製到模型、schema、plan 裡各一份。agent 每次接手都要讀過這些，真正需要的那幾行被淹掉。

本 skill 只做**不改變意思的瘦身**：收合、搬走、改成引用。判斷「這段還算不算數」是人的事，改上游文件的內容是上游 skill 的事。

## 定位

- **輸入**：`docs/` 底下全部文件——`domain/business-rules/`、`domain/model/`、`db/schema.md`、`api/contract.md`、`ui/screens/`、`architecture/`、`impl/`（`backlog.md`、`debt.md`、各 feature 的 `plan.md` 與 `verification.md`）、`security/audit-*.md`——以及 git 歷史。
- **輸出**：收合後的 `plan.md`、`docs/archive/` 下被搬走的檔案、改成引用的下游文件、一份過時內容的裁定清單、每一類一個 commit，最後直推 base branch。
- **不做**：改規則、模型元素、table、端點、畫面規格的**內容**（交給 `/domain:business-rules`、`/domain:model`、`/db:schema`、`/api:contract`、`/ui:screens`）；拆分過大的單一檔案；改產品程式碼；碰還在進行中的 feature。

## 核心規則

1. **不改寫語意。** 只允許三種動作：收合（同樣的資訊用更少的行數）、搬移（`git mv` 到 `docs/archive/`）、改成引用（複本換成 ID，原文還在擁有它的文件裡）。任何會讓一句規則的意思變得不一樣的改動，都不是本 skill 能做的。
2. **只碰已經結束的東西。** 只有**已合併進 base branch** 的 feature 才收合與歸檔（判斷方式見 Step 0）。進行中 feature 的 `done` task 備註是下一個 task 的記憶（`/impl:plan` 的接手協議），一行都不能動。`backlog.md` 有 `doing` 的 feature 時，它的整個目錄都跳過。
3. **追溯不能斷。** 收合後的 task 一定保留 `ID`、`標題`、`來源`、`commit`、`狀態`。`/domain:feedback` 追漣漪時靠「來源」找到要標回 `todo` 的 task，已合併的 feature 也在它的範圍內；刪掉來源，規則改了就沒人知道要重做。
4. **沒被消費的東西不准消失。** 收合或歸檔之前，先處理還有下游要讀的內容：
   - plan 備註裡的技術債、verification 的 `low` findings → `/impl:refactor` 會掃它們，但歸檔後就掃不到了。先照 `debt.md` 的格式追加成 `待處理` 的列（來源寫 `<feature> T-00X 備註` / `<feature> verification finding #N`），已經在 `debt.md` 來源欄裡的不重複加。
   - 「上游回饋」表**整張保留不動**：狀態欄只有 `/domain:feedback` 能改，`已駁回` 的理由是防止同一個問題被再提一次的。
5. **擁有者只有一個。** 每一種內容只有一份文件擁有它（`references/detect.md` 的擁有者表），其他文件只能寫 ID 加最多一行摘要。複本跟原文**一字不差或只差排版**才是重複，可以直接改成引用；內容已經不一樣的是分岔，歸到第 3 類由人裁定哪一份才對，不可以默默以原文為準。
6. **刻意的重複不是重複。** `plan.md` 與 `backlog.md` 的「執行協議」段（規定要原樣寫進每份檔案，讓沒載入 skill 的 agent 也能接手）、`plan.md` 規則覆蓋表的一行摘要、`schema.md` 不變量落點表裡的不變量名稱、`contract.md` 棄用期內的舊端點——這些一律不動。
7. **過時與否由人決定。** 第 3 類只列清單，用 `AskUserQuestion` 一次問完；每一條附證據（引用在哪、被引用的東西去哪了、最後一次改它的 commit）。沒問過就刪，等於替產品做了決定。
8. **每一類一個 commit。** 做完一類就呼叫 `/git:commit`，不要把三類混在一起：哪一類出錯可以單獨 revert。搬檔一律 `git mv`，保留歷史。
9. **工作區要乾淨才開始。** `git status` 有未提交的變更就停下來，請使用者先處理——否則本 skill 的 commit 會混進別人的改動。

## 流程

### Step 0：盤點

1. `git status` 不乾淨 → 停（核心規則 9）。
2. 量現況：`find docs -name '*.md' -not -path 'docs/archive/*' | xargs wc -l | sort -n`，記下總行數與最大的幾個檔案，收尾時比較。
3. 判斷哪些 feature **已合併**：
   - 有 `docs/impl/backlog.md` → 該列 `狀態` 為 `done`（`階段` 為 `merged`）。
   - 沒有 backlog（直推流程）→ `plan.md` 標頭狀態為 `完成`、所有 task 都是 `done`，且最後一個改到這份 plan 的 commit 已經在遠端 base 上（`git branch -r --contains <hash>` 列得出 `origin/<base>`）。
   - 都不符合 → 視為進行中，跳過（核心規則 2）。
4. 列出這次的範圍給使用者看：哪些 feature 會被收合、哪些檔案會被歸檔、哪些目錄會被掃重複與過時。

### Step 1：做完的東西

格式與指令見 `references/formats.md`。

對每個已合併的 feature：

1. **先收債**（核心規則 4）：讀每個 task 的備註與 `verification.md` 的 `low` findings，分成三種——
   - 技術債（「暫時這樣寫」「之後要抽出來」「順手可以改」、重複實作、debug 殘留）→ 追加進 `docs/impl/debt.md`，`debt.md` 不存在就照 `/impl:refactor` 的格式建立。
   - 執行過程的紀錄（「動到」更正、試過什麼、卡在哪且已解）→ 隨收合丟掉，原文留在 git 歷史。
   - 判斷不出來 → 保留在收合後那一列的「備註」欄，寫進收尾報告。
2. **收合 plan.md**：`## Tasks` 裡 `done` 的 task 段換成一張已完成表（ID / 標題 / 來源 / commit / 狀態），表頭上方寫死「標回 `todo` 時怎麼辦」的說明。其餘段落不動。commit 用 `git log --grep` 找，找不到寫 `—` 並列進收尾報告，不要亂填。
3. **歸檔**：`verification.md` 搬到 `docs/archive/impl/<feature>/verification.md`。

全專案範圍：

4. `debt.md` 裡 `已處理` / `已駁回` 的列 → 搬到 `docs/archive/impl/debt.md`（追加，不覆蓋）；`待處理`、`嘗試失敗`、`需先補測試` 留著。
5. `docs/security/audit-*.md` 只留最新的一份，其餘搬到 `docs/archive/security/`。
6. `docs/archive/README.md` 不存在就建立（內容見 `references/formats.md`），說明這裡的東西不再被任何 skill 讀取。

`backlog.md` 不動：`done` 的列已經只有一行，而且 `/impl:ship` 靠它判斷後面 feature 的前置是否完成。

完成後 → `/git:commit`（`docs: 收合已合併 feature 的 plan 並歸檔驗收報告`）。

### Step 2：互相複製

偵測方法見 `references/detect.md`。

1. 跑重複行偵測，列出出現在兩份以上文件、長度夠長的段落。
2. 依擁有者表判斷每一組裡哪一份是原文，其他是複本。排除刻意的重複（核心規則 6）。
3. 逐組比對：
   - 一字不差或只差排版 → 複本換成「ID + 最多一行摘要」（`BR-ORD-004（出貨後不可取消）`），寫法與原文件既有的引用一致。
   - 內容已分岔 → 不改，記進 Step 3 的清單。
4. 改完重跑一次偵測，確認重複真的少了，而且每個新寫的 ID 都解析得到（Step 3 的懸空引用檢查）。

完成後 → `/git:commit`（`docs: 把複製到下游文件的規則內文改為引用 ID`）。

### Step 3：過時內容

偵測方法見 `references/detect.md`。找四種：

1. **懸空引用**：被引用的 ID 或錨點在擁有者文件裡已經找不到（`BR-ORD-009`、`order.md#Order.refund`、`schema.md#refunds`、`contract.md#POST /refunds`）。
2. **孤兒元素**：模型元素的來源 BR 都不存在了；schema 的 table 對應的模型元素不存在了；畫面規格用到的端點不在契約裡了。
3. **分岔的複本**：Step 2 留下來的。
4. **歷史段落**：標著「舊版」「原本」「已棄用」「廢止」的段落、刪除線、整份標記為被取代的規則文件。`contract.md` 還在棄用期內的不算（核心規則 6）。

每一條附證據：在哪個檔案第幾行、指向什麼、那個東西最後出現在哪個 commit（`git log -S '<ID>' --oneline -- docs/`）。

整理成清單，用 `AskUserQuestion` 一次問完（一題最多 4 個選項，條目多就分幾題或用 multiSelect 依類型分批，但同一輪問完，不要問一條等一條）。每條的選項依情況給：

- 刪掉這段 / 這個引用
- 引用改指到 `<新的 ID>`（偵測時找得到改名對象才給）
- 保留，它還算數（同時說明要不要補回被引用的東西）

裁定後依位置執行：

| 位置 | 誰改 |
|---|---|
| `docs/impl/`（plan、verification、backlog、debt） | 本 skill 直接改 |
| `business-rules/` | `/domain:business-rules` |
| `domain/model/` | `/domain:model` |
| `db/schema.md` | `/db:schema` |
| `api/contract.md` | `/api:contract` |
| `ui/screens/` | `/ui:screens` |

上游的改動會牽動下游（規則刪了，模型、schema、task 要跟著動）——交給上游 skill 後，照 `/domain:feedback` 的 Step 5 追一次漣漪。

一條待裁定的都沒有 → 跳過，不要為了有事做而硬找。

完成後 → `/git:commit`（`docs: 移除過時的引用與段落`）；上游 skill 自己的 commit 照它們的流程。

### Step 4：推送與報告

三類都 commit 完，呼叫 `/git:push` 直推 base branch。

在對話中回報：

1. 行數：整理前 → 整理後（不含 `docs/archive/`），以及最大的幾個檔案變化
2. 做完的東西：收合了哪幾個 feature、幾個 task；歸檔了哪些檔案；追加進 `debt.md` 幾筆
3. 互相複製：改成引用幾處、留給 Step 3 的分岔幾處
4. 過時內容：發現幾條、各自怎麼裁定、交給哪個 skill
5. 沒處理的：判斷不出來的備註、找不到 commit 的 task、跳過的進行中 feature
6. 還是太大的檔案：整理後單檔仍超過約 1000 行的（通常是 `schema.md` 或 `contract.md`），建議依 table 群組或資源拆檔——拆檔不在本 skill 範圍
7. `/git:push` 的結果

## 判斷準則

- `references/formats.md`：已合併的判斷指令、收合後的 plan.md 格式、找 task commit 的指令、`debt.md` 追加格式、`docs/archive/` 的目錄結構與 README（Step 0–1 必讀）
- `references/detect.md`：擁有者表、刻意重複的清單、重複行偵測腳本、ID 與錨點的格式、懸空引用與孤兒元素的找法（Step 2–3 必讀）

## 常見失敗模式

| 症狀 | 為什麼是錯的 |
|---|---|
| 收合 task 時連「來源」一起刪掉 | `/domain:feedback` 追漣漪找不到要重做的 task，規則改了沒人知道（核心規則 3） |
| 收合進行中 feature 的 `done` task | 那些備註是下一個 task 的記憶（核心規則 2） |
| 直接歸檔有債的 `verification.md` | `/impl:refactor` 只掃 `docs/impl/*/`，`low` findings 從此沒人處理（核心規則 4） |
| 清掉上游回饋表裡 `已處理` 的列 | 狀態欄只歸 `/domain:feedback` 管，`已駁回` 的理由還在擋重複提問（核心規則 4） |
| 把兩份內容不同的段落當重複，以原文為準 | 下游那份可能才是後來修正過的；分岔要人裁定（核心規則 5） |
| 把每份 plan.md 的「執行協議」改成引用 | 它是刻意複製的，接手的 agent 不一定載入了 skill（核心規則 6） |
| 看到引用指向不存在的 BR 就直接刪掉 | 可能是規則被誤刪，該補回的是規則（核心規則 7） |
| 自己去改 model.md 的孤兒實體 | 模型內容歸 `/domain:model`，本 skill 只裁定、不改上游（Step 3） |
| 用 `rm` 加 `git add` 歸檔 | 歷史斷掉，之後 `git log --follow` 追不到（核心規則 8） |
| 三類改動放同一個 commit | 改引用改壞了，只能連歸檔一起 revert（核心規則 8） |
