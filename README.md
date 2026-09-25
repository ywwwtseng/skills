# skills

ywwwtseng 的個人 Claude Code plugins。

## 安裝

在 Claude Code 中：

```
/plugin marketplace add ywwwtseng/skills
/plugin install domain@skills
/plugin install arch@skills
/plugin install db@skills
/plugin install api@skills
/plugin install impl@skills
/plugin install ui@skills
/plugin install git@skills
/plugin install security@skills
```

本機開發時可直接用路徑：

```
/plugin marketplace add /Users/yw/Devlopment/skills
```

## Plugins

Plugin 依分類命名，skill 的呼叫名稱是 `/<plugin>:<skill>`。

| Plugin | Skill | 呼叫 | 說明 |
|---|---|---|---|
| domain | business-rules | `/domain:business-rules`（也會自動載入） | 只要描述「要解決什麼問題」與「想要什麼功能」，就推導出逐條可驗證的 business rules（定義 / 約束 / 計算 / 狀態流轉 / 權限 / 時間 / 觸發 / 例外），先推導再提問（一次只問一題，每個選項附上對規則的影響），輸出 `docs/domain/business-rules/<主題>.md`；類別 checklist 與邊界條件在 `domain/skills/business-rules/references/` |
| domain | model | `/domain:model`（也會自動載入） | 把 `docs/domain/business-rules/` 的 business rules 累積成一套概念層 domain model（實體 / 值物件 / 列舉 / 不變量 / 關聯 / 狀態機 / 命令 / 領域事件），每個元素追溯到規則 ID；規則依功能分檔、模型依聚合分檔，輸出 `docs/domain/model/<聚合>.md` + `shared.md` + `README.md`；只做領域概念、不做 table / 欄位 / 索引等 DB schema；對應細則在 `domain/skills/model/references/mapping.md` |
| domain | feedback | `/domain:feedback` | 把實作階段累積在 `docs/impl/*/plan.md` 與 `verification.md` 的「上游回饋」一次收齊（**全部 feature**，同一問題跨檔去重）、逐條分類成規則矛盾 / 規則缺漏 / 模型缺概念 / schema 缺欄位或落點錯 / 誤報，不需裁定的直接呼叫 `/domain:business-rules`、`/domain:model`、`/db:schema` 補，需要產品決策的整理成清單一次問完（不在第一條就停下來等人），再順著 `BR → model → schema → task` 追漣漪，把受影響且已 `done` 的 task 標回 `todo`；狀態寫回原處不另開總帳、不自己編規則、不自己改上游文件 |
| arch | tech-stack | `/arch:tech-stack` | 多輪問答選型 frontend / mobile / backend / database / infra、架構模式與 **UI 風格**（`tonal-ui` / `calm-ui` / 既有設計系統，兩套視覺語言互斥所以在這裡就寫死），輸出 `docs/architecture/tech-stack.md`；UI 風格同時進「約束與慣例」第一條，有 App 時再加一條「行動端本機開發預設開 iOS 模擬器」並附該技術棧的開發指令 |
| arch | init | `/arch:init` | 讀 `docs/architecture/tech-stack.md`，把專案實際建起來：repo 骨架、官方 scaffold 指令、lint / test / 型別檢查、`.env.example`、CI、`CLAUDE.md` 約束段落（**UI 風格那一條一定要寫進去**——`CLAUDE.md` 每個 session 自動載入，視覺語言 skill 被觸發前答案就已在 context 裡），最後跑一次 typecheck / lint / test / build 驗證；不 commit、不建雲端資源、不寫 secrets；scaffold 指令表在 `arch/skills/init/references/scaffold.md` |
| arch | test-strategy | `/arch:test-strategy` | 決定「哪一類規則用哪一層測試驗」並把那一層的環境建起來，輸出 `docs/architecture/testing.md`：規則類型 → 測試層對照（**落點是 DB 約束的不變量一定打真的測試資料庫**，權限與契約錯誤碼從 HTTP 進去驗，E2E 只走關鍵流程）、`test:unit` / `test:integration` / `test:e2e` 指令、測試資料庫隔離（交易回滾 / worker schema / 測試容器，只允許本機或容器）、fixture 慣例、mock 邊界、CI 步驟，並把測試慣例寫進 `CLAUDE.md`；三種模式——新專案（只定策略建環境）、開發中已有測試（盤點現況找分層差距）、開發中零測試（先建框架，再由外往內補特徵測試）；先跑既有測試量基準、紅的就停，依風險補而不追覆蓋率，新測試連跑兩次（第二次打亂順序）都綠才算；不改產品程式碼、不改或搬既有測試、不換框架、不修 bug——補測試時發現與 BR 不符的記成「疑似缺陷」交 `/impl:fix`，不寫成斷言現況的測試把 bug 鎖死；`/impl:plan`、`/impl:feature`、`/impl:verify` 依 `testing.md` 決定與檢查測試層級；細則在 `arch/skills/test-strategy/references/`（`layers.md`、`template.md`） |
| db | schema | `/db:schema` | 讀 `docs/domain/model/` 的概念層模型，輸出單一份 `docs/db/schema.md`（收尾會掃一次**過期引用**：這次改名或移除的識別名還被哪些文件引用，標明結論是否受影響，但不自己去改別人的文件）：table / collection、欄位與型別、主鍵外鍵、唯一約束、CHECK、索引、列舉落地、每條不變量的執行落點（DB 約束 or 應用層）、並行策略、遷移順序與破壞性變更；每張表與欄位都追溯回模型元素與規則 ID，模型缺漏回報而不在 schema 層補；只產設計文件，不寫 migration / ORM 檔；對應細則在 `db/skills/schema/references/`（`mapping.md`、`conventions.md`、`dialects.md`、`template.md`） |
| db | migrate | `/db:migrate` | 把 `docs/db/schema.md` 變成真的 migration：先 introspect 現況算出與目標的 **diff**（不憑文件重建整份 CREATE TABLE）、把變更分成安全 / 需回填 / 破壞性三類、一個 migration 一件事且都寫得出 down（寫不出的標不可逆、單獨成檔）、同步 ORM schema 並用原生 SQL 補回 ORM 表達不出的 CHECK 與部分索引、**只對本機或開發資料庫套用**（連線判斷不出來就停）並用 `up → introspect 比對 → down → up` 驗證可回滾；破壞性變更依 expand-migrate-contract 拆階段，contract 只產檔不執行並附 runbook；工具指令在 `db/skills/migrate/references/tools.md`、各類變更配方在 `destructive.md` |
| api | contract | `/api:contract` | 把 `docs/domain/model/` 的命令、查詢與領域事件轉成客戶端能依賴的契約，輸出單一份 `docs/api/contract.md`：端點（一個命令一個操作，狀態轉換各自獨立而不是 `PATCH {status}`）、request / response 欄位與型別、**每條 BR 的失敗情境都對應一個錯誤碼**（業務規則失敗不回 400）、統一的錯誤 envelope、認證授權、分頁排序篩選慣例、冪等與重試、推播 payload、以及向後相容規則與棄用流程；跟 `/db:schema` 對稱——兩者都吃同一份模型，一個回答「狀態怎麼存」，一個回答「外界怎麼呼叫」；行動端專案必備（舊版 app 會在手機上留數個月，契約發布後就是承諾）；細則在 `api/skills/contract/references/`（`mapping.md`、`compat.md`、`styles.md`、`template.md`） |
| impl | ship | `/impl:ship` | 一人開發的無人看守總調度。**第一輪先跑起飛前檢查**（`impl/skills/ship/references/preflight.md`）：環境（git / origin / `gh` / 工作區 / 分支）→ 文件鏈（規則 / 模型 / tech-stack，以及依專案形狀的 schema / contract / screens）→ 程式碼骨架（scaffold、驗證指令真的跑得起來、測試分層已決定）→ 一次性落地（資料表已建、UI 風格已宣告），任一項不通過就停下來說明缺什麼、要跑哪個 skill——這些缺漏不會讓迴圈立刻失敗，而是讓它在做完最多工之後才停（最典型的是整個 feature 驗收過了，才在 `/git:pr` 第一步發現沒有遠端）。通過後維護 `docs/impl/backlog.md` 的 feature 佇列（feature / 規則文件 / 前置 / 狀態 / 階段 / PR），每輪先清掉 `high` 的待處理上游回饋，再依**檔案實況**（有沒有 plan.md、還有沒有未完成 task、有沒有 verification.md、verdict 是什麼）判斷當前 feature 走到哪一階段，**只呼叫那一個 skill**（`/impl:plan` → `/impl:feature` → `/impl:verify` → `/git:pr --merge`），回寫佇列後才進下一輪；合併後確認已切回 base branch 才取下一個 feature；只在佇列跑完 / `blocked` / verify `fail` / 需要規則裁定 / 使用者喊停時停下來；不寫程式碼、不開 PR、不決定專案要做什麼 |
| impl | plan | `/impl:plan` | 把一個 feature 的 `docs/domain/business-rules/`、`docs/domain/model/`、`docs/db/schema.md` 切成可獨立驗證、可續跑的 task 清單，輸出 `docs/impl/<feature>/plan.md`：每個 task 帶追溯 ID、預估動到的檔案、前置依賴、驗收指令與狀態，檔案開頭自帶「執行協議」，讓被壓縮或跨 session 的 agent 只讀這份檔案就能接手；垂直切片優先（每個 task 做完系統仍可跑）、一個 task 一個 context window 一個 commit；不寫產品程式碼，實作由 `/impl:feature` 逐個 task 執行，每個 task 結束由 `/git:commit` 建還原點 |
| impl | feature | `/impl:feature` | 依 `docs/impl/<feature>/plan.md` 逐個 task 實作：找出執行序上第一個未完成的 task、只載入它「來源」與「動到」指到的上下文、寫程式與測試（案例取自 BR 的「輸入 → 預期結果」）、跑驗收指令（該 task 的 + 既有測試不能紅）、回寫狀態到 plan.md、呼叫 `/git:commit` 帶 task ID 建還原點，然後才進下一個；驗收沒過不標 done、卡住三次改 `blocked` 停下來問、不擴張範圍也不改切法（要改回 `/impl:plan`）；不 push |
| impl | verify | `/impl:verify` | 開 PR 前的品質閘門：逐條走 `docs/domain/business-rules/` 的 BR，確認每條都有測試在驗（帶行號證據，分 `完整覆蓋` / `部分覆蓋` / `有實作無測試` / `未覆蓋`）、`docs/db/schema.md` 的不變量落點是否真的落地、全套驗證指令實跑一次、抽查測試有沒有被動手腳（`.skip` / 恆真斷言 / 既有預期值被改 / 上游文件被改）、diff 有沒有洩出 plan 的「不做」範圍；輸出 `docs/impl/<feature>/verification.md` 並給 `pass` / `pass with findings` / `fail`，每個缺口回寫成 plan.md 末尾的新 task 讓 `/impl:feature` 自動去補；只稽核不修、不下 git 指令 |
| impl | fix | `/impl:fix` | plan 之外的修復迴路：先分流「規則說 A 程式做 B」（是 bug，修）/「規則沒寫這情況」（是缺規則，回 `/domain:business-rules`）/「程式照規則做但期望不同」（是規則變更），再寫一個**會紅的** regression test 釘住 bug（重現不出來就停，不准憑症狀猜）、找 root cause 而非症狀、做最小改動（不順手重構）、驗收新測試綠且既有測試不變紅、查一次同源問題（同一個 root cause 的其他呼叫點）、成因屬設計問題就開一條上游回饋，最後由 `/git:commit` 提交並把 root cause 與「既有測試為什麼沒抓到」寫進 body；動到超過 3 個檔案或要改介面就回 `/impl:plan` |
| impl | refactor | `/impl:refactor` | 技術債的出口：`/impl:feature` 與 `/impl:fix` 都禁止順手改，那些被擋下來的東西全寫進備註後沒有人消費。本 skill 掃各 `plan.md` 的備註、`verification.md` 的 `low` findings、fix 報告裡「發現但沒修」的、程式碼的 TODO / FIXME，彙整成 `docs/impl/debt.md`（開總帳是刻意的——plan 的生命週期到 feature 做完為止，債是跨 feature 累積的），依 `收益 × 風險 × 有沒有測試保護` 排序後逐個執行。最硬的規則是**不准改測試**：既有測試全綠且 `git diff --stat` 裡看不到測試檔，才叫重構；要改測試才能過的那是改行為，退回 `/impl:plan`。沒有測試保護的標「需先補測試」不做（盲改）；一個重構一個 `refactor:` commit，body 寫收益、行為不變的證據與債的來源；**不進 `/impl:ship` 的自動迴圈**，人工觸發；債的分類與各自的安全改法在 `impl/skills/refactor/references/catalog.md` |
| ui | screens | `/ui:screens` | 把規則、模型與契約轉成畫面規格，依畫面分檔輸出 `docs/ui/screens/<畫面>.md` + 含畫面地圖與導航規則的 `README.md`：每個畫面的用途、進入點、顯示什麼（逐項追溯到模型元素）、可觸發哪些命令（對應端點與權限）、版面骨架；**狀態是規格的主體**——逐條走完通用狀態（初次載入 / 空：從來沒有 vs 篩選後沒結果要分開 / 錯誤 / 部分失敗 / 權限不足 / 資料已被刪除）、表單狀態（送出中 / 送出失敗要保留使用者填的內容 / 重複送出對應冪等鍵）、以及行動端特有的離線、送出中斷網、弱網、背景喚醒後過期、推播與深連結進入的返回堆疊、系統權限被拒、鍵盤遮擋、登入過期；契約的每個錯誤碼都要有畫面行為（出現在哪 / 訊息 / 使用者能做什麼）；動作不可用時在隱藏 / disabled 加說明 / 可按才報錯之間三選一並寫理由；不做視覺設計（顏色字級間距交給 `/ui:tonal-ui`）；細則在 `ui/skills/screens/references/`（`states.md`、`template.md`） |
| ui | tonal-ui | `/ui:tonal-ui`（也會自動載入） | **後台／內部系統**的視覺語言：不畫框線、用底色色塊分層（Gmail / Material 3 tonal surface）。做新畫面、新元件、改版或 design review 時套用；token 在 `ui/skills/tonal-ui/references/tokens.css` |
| ui | calm-ui | `/ui:calm-ui`（也會自動載入） | **消費級 AI-native 產品**的視覺與互動語言：深色優先、極少裝飾，資訊層級靠排版與留白而不是卡片與框線；核心是「智慧用行為表達」——主動偵測、已完成的工作、明確的下一步，而不是發光球體、紫藍漸層、閃亮圖示、機器人圖示這些 AI 陳腔濫調；介面要三秒內回答「什麼需要我注意 / Agent 在做什麼 / 它需要我做什麼決定」；含 Agent Feed 首頁（不是 widget 牆）、輕量對話（不是每則訊息一張卡片）、任務的「已完成 / 進行中 / 接下來」（不是 Jira）、八種 Agent 狀態、通知、3–4 項導航的版型與文案，以及改版時「最後才處理顏色」的 13 步順序；**跟 `/ui:tonal-ui` 二選一不可混用**；token 在 `ui/skills/calm-ui/references/tokens.css`、版型在 `patterns.md` |
| git | commit | `/git:commit` | 檢視 `git status` / `git diff`，把待提交內容切成多個邏輯變更，逐一 stage（絕不 `git add -A` / `.` / `-u`，排除 `node_modules`、`dist`、`.env`、secrets）並建立 Conventional Commit 格式的 commit，直到沒有可提交的檔案，不 push |
| git | pr | `/git:pr [--merge] [base]` | 把 feature 的 commit 變成可審查的 PR：commit 留在預設分支時先安全搬到 `feat/<feature>`（先建分支確認 commit 都在，再把本地 base 指回 `origin/<base>`，全程不 reset / rebase / cherry-pick）、跑驗證閘門（有 `verification.md` 就採信其 verdict，`fail` 直接停；沒有就實跑 typecheck / lint / test / build）、檢查外送 diff 有沒有 secrets 與 build 產物、`push -u` 後用 `gh` 開 PR，body 帶 task 表 / BR 覆蓋表 / 驗收結果 / 待處理 / 審查重點；plan 還有未完成 task 或有 findings 就開 draft；加 `--merge`（一人開發的無人看守模式，`/impl:verify` 是唯一閘門）時，在「非 draft + verdict 為 `pass` + CI 綠 + 無衝突 + 無 CHANGES_REQUESTED」全部成立下用 `--rebase --delete-branch` 合併（保留每個 task 的還原點，不 squash），再 `switch` 回 base 並 `pull --ff-only`，讓下一個 feature 從乾淨起點開始；沒有 `--merge` 就只開 PR，不 force push、不推預設分支 |
| security | audit | `/security:audit`（僅手動執行，不會自動載入） | 依序跑五類掃描再由 Claude 分析：Secrets（Gitleaks，掃 git 全部歷史與工作目錄，一律 `--redact`）→ Dependencies（依 lockfile 選 npm / pnpm / yarn / bun audit，非 JS 專案用 Trivy fs）→ Source Code（Semgrep，`--metrics=off`、不用 `--config auto`）→ IaC（Trivy config，含 Terraform 與 tfvars）→ Docker（Trivy image，只掃本機已有的 image，不自動 build）→ Review（統一嚴重度、合併重複、**每條 HIGH 以上都打開原始碼確認**、誤報移到「已排除」、依框架列出全部對外入口後依風險深讀，照九類清單人工檢查掃描器看不到的問題（IDOR / mass assignment / RLS、JWT 與 session、跨檔案注入、SSRF / open redirect / CSRF / CORS / webhook 驗簽、檔案上傳、前端算的金額 / 負數 / 狀態跳步 / race condition、資料外洩、可預測的 token），有 business rules 時拿權限與約束規則當正確答案，報告寫明入口總數與深讀數），輸出 CRITICAL / HIGH / MEDIUM / LOW 計數、掃描涵蓋表（沒跑的標 `skipped`，絕不寫成「未發現問題」）與逐條 finding（File / Source / Fix）；原始報告放 repo 外的暫存目錄；只讀不改，不跑 `npm audit fix`、不 commit |

## 結構

一個分類資料夾就是一個 plugin，裡面可以放多個 skill；skill 呼叫時會帶 plugin 前綴（例如 `/domain:model`）。

```
.
├── .claude-plugin/marketplace.json   # 列出所有 plugin，source 指向分類資料夾
├── domain/                           # 領域建模：business-rules、model、feedback
├── arch/                             # 架構決策：tech-stack、init、test-strategy
├── db/                               # 資料庫設計：schema、migrate
├── api/                              # 介面契約：contract
├── impl/                             # 實作執行：ship、plan、feature、verify、fix、refactor
├── ui/                               # UI：screens、tonal-ui、calm-ui
├── git/                              # git 工作流：commit、pr
├── security/                         # 資安掃描：audit
└── <plugin>/
    ├── .claude-plugin/plugin.json    # plugin 名稱、版本
    ├── commands/<command>.md         # slash command（可選）
    ├── skills/<skill-name>/SKILL.md  # skill 本體（可選）
    └── skills/<skill-name>/references/
```

## 新增 skill

1. 選一個分類 plugin（沒有合適的就新增一個分類資料夾 + `.claude-plugin/plugin.json`，並在 `.claude-plugin/marketplace.json` 的 `plugins` 陣列加入一筆，`source` 寫 `./<plugin>`）
2. 在 `<plugin>/skills/<skill-name>/SKILL.md` 寫 skill（或 `<plugin>/commands/<command>.md` 寫 slash command）
3. 升 `<plugin>/.claude-plugin/plugin.json` 與 `marketplace.json` 的 `version`，執行 `/plugin update <plugin>@skills` 即可取得

## 更新 skill 與本地安裝

`skills` marketplace 預設從 GitHub `ywwwtseng/skills` 安裝，本地安裝的版本跟著**遠端 repo** 走；plugin 依版本號建 cache 目錄（`~/.claude/plugins/cache/skills/<plugin>/<version>/`），**版號不變會被視為已安裝而不更新**。

每次改 skill 的固定流程：

1. 改 `<plugin>/skills/<skill>/SKILL.md`（或 `references/`、`commands/`）
2. 升版：`<plugin>/.claude-plugin/plugin.json` 與 `.claude-plugin/marketplace.json` **兩處**的 `version` 都要改
3. `/commit` → `git push origin main`
4. 在 Claude Code 更新 marketplace 索引與 plugin：

   ```
   /plugin marketplace update skills
   /plugin update <plugin>@skills
   ```

   若 update 沒生效，改用重裝：

   ```
   /plugin uninstall <plugin>@skills
   /plugin install <plugin>@skills
   ```

5. **重啟 Claude Code**（或開新 session）才會載入新的 SKILL.md

確認方式：`~/.claude/plugins/installed_plugins.json` 裡該 plugin 的 `version` 與 `gitCommitSha` 應對應到最新 commit。

### 本地開發：不經過 GitHub

反覆調整 SKILL.md 時，把 marketplace 來源改成本地目錄，改完檔案開新 session 就生效、不用推送也不用升版：

```
/plugin marketplace remove skills
/plugin marketplace add /Users/yw/Devlopment/skills
/plugin install <plugin>@skills
```

穩定後再切回 GitHub 來源：

```
/plugin marketplace remove skills
/plugin marketplace add ywwwtseng/skills
/plugin install <plugin>@skills
```

## 更新 tech-stack 的選型準則

候選技術與情境對應表在 `arch/skills/tech-stack/references/`，每層一個檔案（`frontend.md`、`mobile.md`、`backend.md`、`database.md`、`infra.md`、`architecture.md`、`scale.md`）。改完後升 `plugin.json` 與 `marketplace.json` 的 `version`。
