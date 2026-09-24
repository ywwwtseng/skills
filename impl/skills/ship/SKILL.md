---
name: ship
description: 一人開發的無人看守總調度：維護 docs/impl/backlog.md 這份 feature 佇列，然後一輪一輪把佇列上的 feature 從規則跑到進 main——判斷當前 feature 走到哪一階段（規劃 / 實作 / 稽核 / 開 PR / 合併），只呼叫該階段的那一個 skill，做完回寫佇列狀態，合併後切回 base branch 再取下一個。每輪開始前先清掉待處理的上游回饋。當使用者說「一路做下去」「把 backlog 跑完」「今晚自己跑」「做完一個接下一個」「無人看守開發」時使用。本 skill 不自己寫程式、不自己開 PR，只決定下一步該叫誰；不部署、不碰 production。
---

# Impl Ship

`/impl:feature` 只管一個 `plan.md` 裡的 task 迴圈。做完那個 feature 之後，「merge、切回 base、決定下一個做什麼」沒有人管——所以無人看守的粒度一直卡在**一個 feature**。

本 skill 是外層的那一圈。它自己不寫任何程式碼，只回答一個問題：**現在該叫哪一個 skill。**

## 定位：佇列與調度

- **輸入**：`docs/impl/backlog.md`（feature 佇列與狀態）、各 feature 的 `plan.md` 與 `verification.md`、`docs/domain/business-rules/` 下還沒排進佇列的規則文件。
- **輸出**：回寫後的 `backlog.md`，以及被推進的 feature（由下游 skill 實際產出程式碼、PR、merge）。
- **不做**：寫程式碼、開 PR、下 git 指令、改上游文件、部署。全部委派：`/impl:plan`、`/impl:feature`、`/impl:verify`、`/git:pr`、`/domain:feedback`、`/impl:fix`。

`plan.md` 回答「這個 feature 的下一個 task 是什麼」；`backlog.md` 回答「這個專案的下一個 feature 是什麼」。兩份都是檔案，所以兩層都能被壓縮、被中斷、跨 session 續跑。

## 核心規則

1. **一輪只推進一步。** 一輪 = 判斷當前 feature 走到哪 → 呼叫**那一個** skill → 回寫 backlog。不要在同一輪裡硬把規劃、實作、稽核、開 PR 全跑完——那會在中途耗盡 context，而且留下一個說不清楚做到哪的狀態。
2. **狀態一律落在檔案。** 進度寫 `backlog.md` 與各自的 `plan.md`，不要只留在對話裡。驗收標準同 `/impl:plan`：一個完全沒有上下文的新 session 只讀這兩份檔案就要能接手。
3. **不跳過階段。** 順序是 `plan → feature ⟲ → verify → pr`，每一階段的產出是下一階段的輸入。沒有 `verification.md` 就不開 PR、verdict 不是 `pass` 就不合併——閘門就是這樣運作的。一人開發時沒有第二個人會審這個 PR，`/impl:verify` 是唯一有人在看的關卡（`--merge` 的前提）。
4. **該停的時候要停，不該停的時候不要停。** 無人看守不等於不停。停在下面「停止條件」列出的四種情況是對的；停在「PR 開完了但沒有人切回 base」這種機械性動作上，是流程沒接完。
5. **每輪開始先清回饋。** 有 `high` 嚴重度的待處理上游回饋（規則已經寫錯進程式碼了）→ 先跑 `/domain:feedback`，再繼續做新東西。帶著已知錯誤的規則往前做，做得越多錯得越多。
6. **佇列順序依相依，不依喜好。** 前置 feature 沒 `done` 就不能開始後面的。相依關係推不出來就問（一次一題）。多客戶端專案（行動端 / 第三方）固定是**伺服器端 feature 先於客戶端 feature**：契約要先被實作出來並進 main，客戶端才開始，否則客戶端會對著一份還沒實現的文件寫程式，而且整合失敗要到很後面才會被發現。同一個需求拆成 `<feature>-api` 與 `<feature>-app` 兩列，用「前置」欄串起來。
7. **不擅自把新 feature 塞進佇列。** `docs/domain/business-rules/` 出現佇列裡沒有的規則文件時，列出來問要不要排進去、排在哪，不要自己決定專案接下來要做什麼。
8. **卡住就停，並且寫清楚卡在哪。** 下游 skill 回報 `blocked` / `fail` / 需要裁定時，把原因原樣寫進 backlog 的備註再停。停下來時留下「回來的人要做什麼決定」比留下「它壞了」有用得多。
9. **提問必須用 `AskUserQuestion`，一次只問一題。**

## backlog.md 格式

```markdown
# 實作佇列

> 最後更新：<YYYY-MM-DD>　|　進行中：<feature 名 或 無>
> 進度：done <N> / 總數 <M>

## 執行協議

<原樣抄下方「與下游 skill 的協議」。接手的 agent 可能沒載入本 skill。>

## 佇列

| # | Feature | 規則文件 | 前置 | 狀態 | 階段 | PR | 備註 |
|---|---|---|---|---|---|---|---|
| 1 | order-cancellation | `docs/domain/business-rules/order-cancellation.md` | 無 | done | merged | #12 | |
| 2 | refund | `docs/domain/business-rules/refund.md` | 1 | doing | feature 3/7 | — | |
| 3 | notification | `docs/domain/business-rules/notification.md` | 2 | todo | — | — | |

- **狀態**：`todo` / `doing` / `blocked` / `done`
- **階段**（`doing` 時才有值）：`plan` / `feature <done>/<總數>` / `verify` / `pr` / `merged`
- **PR**：編號與狀態（`#12 draft`、`#12 merged`）

## 不做

<明確排除的 feature，避免自己擴張>

## 變更紀錄

| 日期 | 變動 |
|---|---|
```

## 流程

### Step 0：建立或讀取佇列

`docs/impl/backlog.md` 不存在 → 建立：

1. 列出 `docs/domain/business-rules/` 下所有規則文件。一份都沒有 → 說明要先有規則，建議 `/domain:business-rules`，停止。
2. 掃 `docs/impl/*/plan.md`，已經有 plan 的 feature 依其進度填狀態（不要把做過的當成 `todo` 重做一次）。
3. 依規則文件之間的引用與領域相依推出順序，寫進「前置」欄。推不出來的用 `AskUserQuestion` 問一題。
4. 寫入檔案，列出佇列給使用者確認後再開始跑。

已存在 → **完整讀過**：佇列、階段、全部備註、變更紀錄。備註是上一輪的記憶。

### Step 1：每輪的前置檢查

1. `git status` — 工作區不乾淨且不屬於當前 `doing` 的 feature → 停下來問。
2. 掃各 `plan.md` 的「上游回饋」表：有 `high` 的待處理項 → 先跑 `/domain:feedback`，這一輪就到此為止（核心規則 5）。
3. `docs/domain/business-rules/` 有佇列裡沒有的規則文件 → 列出來問（核心規則 7）。

### Step 2：選 feature

1. 有 `doing` 的 → 就是它（一次只做一個）。
2. 沒有 → 取第一個 `todo` 且前置全部 `done` 的，狀態改 `doing`。
3. 有 `blocked` 擋在前面且未解 → 先處理它，不要跳過去做後面的。
4. 佇列全部 `done` → 進 Step 5 收尾。

### Step 3：判斷階段，呼叫**一個** skill

依當前 feature 的檔案實況判斷（不要憑 backlog 上寫的階段，那是上一輪的紀錄）：

| 實況 | 呼叫 | 之後階段 |
|---|---|---|
| 沒有 `docs/impl/<feature>/plan.md` | `/impl:plan` | `plan` → `feature 0/N` |
| plan 有非 `done` 的 task | `/impl:feature` | `feature <done>/<總數>` |
| plan 全 `done`，沒有 `verification.md` 或它比最後一個 commit 舊 | `/impl:verify` | `verify` |
| verdict `fail` 或 `pass with findings`（缺口已被寫成新 task） | `/impl:feature` | 回到 `feature` |
| verdict `pass` | `/git:pr --merge` | `pr` → `merged` |
| PR 已 merge | 標 `done`，回 Step 2 取下一個 | — |

`/git:pr --merge` 會在合併後切回 base branch 並 pull（它的 Step 9）。**確認它真的切回去了**再進下一個 feature——沒切回去的話，下一個 feature 的 commit 會疊在上一個分支上。

### Step 4：回寫 backlog

每一輪結束都要寫（核心規則 2）：狀態、階段、PR 編號、最後更新、進度。下游 skill 回報的卡點原樣寫進備註。

### Step 5：停止條件

只有這五種情況停：

| 停止原因 | 怎麼回報 |
|---|---|
| 佇列全部 `done` | 列出這一輪完成的 feature 與 PR，宣告收工 |
| task `blocked`（`/impl:feature` 回報） | 原樣寫進備註：卡在哪 / 試過什麼 / 需要什麼才能解 |
| verify `fail` 且缺口無法自動補（測試被動過手腳、規則根本沒定義） | 寫明是哪一條 finding |
| `/domain:feedback` 需要規則裁定 | 列出待決問題 |
| 使用者喊停 | — |

其餘一律繼續下一輪。要真的整晚跑，用 `/loop`（不給 interval，讓它自己抓節奏），每輪就是 Step 1–4。

### Step 6：收尾

在對話中：

1. 這一輪推進了什麼：feature、階段從哪到哪、呼叫了哪個 skill
2. 佇列進度：`done N / 總數 M`，下一個是哪個 feature
3. 已合併的 PR（編號與標題）
4. 停止原因（若停了）與「回來的人要做什麼決定」
5. 當前分支與工作區是否乾淨

## 與下游 skill 的協議

這段要原樣寫進每份 `backlog.md` 的「執行協議」段（核心規則 2）：

1. **接手**：讀 backlog → 有 `doing` 的 feature 就是它；沒有就取第一個前置已 `done` 的 `todo`。
2. **判斷階段看檔案實況**（有沒有 plan.md、plan 裡還有沒有未完成 task、有沒有 verification.md、verdict 是什麼），不要憑 backlog 上寫的階段。
3. **一輪只呼叫一個 skill**，做完回寫 backlog 再進下一輪。
4. **不跳階段**：沒有 `verification.md` 不開 PR；verdict 不是 `pass` 不合併。
5. **合併後一定要回到 base branch 並 pull**，確認乾淨後才開始下一個 feature。
6. **卡住就停**，把下游回報的原因原樣寫進備註，不要自己想辦法繞過去。
7. **不自己決定專案要做什麼**：規則文件沒進佇列就問，不要自己排。

## 常見失敗模式

| 症狀 | 為什麼是錯的 |
|---|---|
| 一輪裡把 plan → feature → verify → pr 全跑完 | 中途 context 就耗盡了，而且留下說不清楚做到哪的狀態（核心規則 1） |
| 憑 backlog 上寫的階段決定下一步 | 那是上一輪寫的；檔案實況才是真的（Step 3） |
| verdict 是 `pass with findings` 就合併 | 那些 findings 已經被寫成 task 了，合併等於把它們留在 main（核心規則 3） |
| PR 合併後沒切回 base 就開始下一個 feature | 下一個 feature 的 commit 疊在舊分支上，被捲進舊 PR（Step 3 末） |
| 帶著 `high` 的待處理回饋繼續做新 feature | 規則已經錯進程式碼了，做越多錯越多（核心規則 5） |
| 看到新的規則文件就自己排進佇列開始做 | 專案要做什麼不是 agent 決定的（核心規則 7） |
| `blocked` 時只寫「卡住了」 | 回來的人不知道要做什麼決定，等於沒有回報（核心規則 8） |
