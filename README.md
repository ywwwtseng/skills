# skills

ywwwtseng 的個人 Claude Code plugins。

## 安裝

在 Claude Code 中：

```
/plugin marketplace add ywwwtseng/skills
/plugin install domain@skills
/plugin install arch@skills
/plugin install db@skills
/plugin install impl@skills
/plugin install ui@skills
/plugin install git@skills
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
| arch | tech-stack | `/arch:tech-stack` | 多輪問答選型 frontend / mobile / backend / database / infra 與架構模式，輸出 `docs/architecture/tech-stack.md` |
| arch | init | `/arch:init` | 讀 `docs/architecture/tech-stack.md`，把專案實際建起來：repo 骨架、官方 scaffold 指令、lint / test / 型別檢查、`.env.example`、CI、`CLAUDE.md` 約束段落，最後跑一次 typecheck / lint / test / build 驗證；不 commit、不建雲端資源、不寫 secrets；scaffold 指令表在 `arch/skills/init/references/scaffold.md` |
| db | schema | `/db:schema` | 讀 `docs/domain/model/` 的概念層模型，輸出單一份 `docs/db/schema.md`：table / collection、欄位與型別、主鍵外鍵、唯一約束、CHECK、索引、列舉落地、每條不變量的執行落點（DB 約束 or 應用層）、並行策略、遷移順序與破壞性變更；每張表與欄位都追溯回模型元素與規則 ID，模型缺漏回報而不在 schema 層補；只產設計文件，不寫 migration / ORM 檔；對應細則在 `db/skills/schema/references/`（`mapping.md`、`conventions.md`、`dialects.md`、`template.md`） |
| impl | plan | `/impl:plan` | 把一個 feature 的 `docs/domain/business-rules/`、`docs/domain/model/`、`docs/db/schema.md` 切成可獨立驗證、可續跑的 task 清單，輸出 `docs/impl/<feature>/plan.md`：每個 task 帶追溯 ID、預估動到的檔案、前置依賴、驗收指令與狀態，檔案開頭自帶「執行協議」，讓被壓縮或跨 session 的 agent 只讀這份檔案就能接手；垂直切片優先（每個 task 做完系統仍可跑）、一個 task 一個 context window 一個 commit；不寫產品程式碼，實作由 `/impl:feature` 逐個 task 執行，每個 task 結束由 `/git:commit` 建還原點 |
| impl | feature | `/impl:feature` | 依 `docs/impl/<feature>/plan.md` 逐個 task 實作：找出執行序上第一個未完成的 task、只載入它「來源」與「動到」指到的上下文、寫程式與測試（案例取自 BR 的「輸入 → 預期結果」）、跑驗收指令（該 task 的 + 既有測試不能紅）、回寫狀態到 plan.md、呼叫 `/git:commit` 帶 task ID 建還原點，然後才進下一個；驗收沒過不標 done、卡住三次改 `blocked` 停下來問、不擴張範圍也不改切法（要改回 `/impl:plan`）；不 push |
| impl | verify | `/impl:verify` | 開 PR 前的品質閘門：逐條走 `docs/domain/business-rules/` 的 BR，確認每條都有測試在驗（帶行號證據，分 `完整覆蓋` / `部分覆蓋` / `有實作無測試` / `未覆蓋`）、`docs/db/schema.md` 的不變量落點是否真的落地、全套驗證指令實跑一次、抽查測試有沒有被動手腳（`.skip` / 恆真斷言 / 既有預期值被改 / 上游文件被改）、diff 有沒有洩出 plan 的「不做」範圍；輸出 `docs/impl/<feature>/verification.md` 並給 `pass` / `pass with findings` / `fail`，每個缺口回寫成 plan.md 末尾的新 task 讓 `/impl:feature` 自動去補；只稽核不修、不下 git 指令 |
| impl | fix | `/impl:fix` | plan 之外的修復迴路：先分流「規則說 A 程式做 B」（是 bug，修）/「規則沒寫這情況」（是缺規則，回 `/domain:business-rules`）/「程式照規則做但期望不同」（是規則變更），再寫一個**會紅的** regression test 釘住 bug（重現不出來就停，不准憑症狀猜）、找 root cause 而非症狀、做最小改動（不順手重構）、驗收新測試綠且既有測試不變紅、查一次同源問題（同一個 root cause 的其他呼叫點）、成因屬設計問題就開一條上游回饋，最後由 `/git:commit` 提交並把 root cause 與「既有測試為什麼沒抓到」寫進 body；動到超過 3 個檔案或要改介面就回 `/impl:plan` |
| ui | tonal-ui | `/ui:tonal-ui`（也會自動載入） | 不畫框線、用底色色塊分層的 UI 風格（Gmail / Material 3 tonal surface）。做新畫面、新元件、改版或 design review 時套用；token 在 `ui/skills/tonal-ui/references/tokens.css` |
| git | commit | `/git:commit` | 檢視 `git status` / `git diff`，把待提交內容切成多個邏輯變更，逐一 stage（絕不 `git add -A` / `.` / `-u`，排除 `node_modules`、`dist`、`.env`、secrets）並建立 Conventional Commit 格式的 commit，直到沒有可提交的檔案，不 push |
| git | pr | `/git:pr` | 把 feature 的 commit 變成可審查的 PR：commit 留在預設分支時先安全搬到 `feat/<feature>`（先建分支確認 commit 都在，再把本地 base 指回 `origin/<base>`，全程不 reset / rebase / cherry-pick）、跑驗證閘門（有 `verification.md` 就採信其 verdict，`fail` 直接停；沒有就實跑 typecheck / lint / test / build）、檢查外送 diff 有沒有 secrets 與 build 產物、`push -u` 後用 `gh` 開 PR，body 帶 task 表 / BR 覆蓋表 / 驗收結果 / 待處理 / 審查重點；plan 還有未完成 task 或有 findings 就開 draft，最後回報 CI 狀態；不合併、不 force push、不推預設分支 |

## 結構

一個分類資料夾就是一個 plugin，裡面可以放多個 skill；skill 呼叫時會帶 plugin 前綴（例如 `/domain:model`）。

```
.
├── .claude-plugin/marketplace.json   # 列出所有 plugin，source 指向分類資料夾
├── domain/                           # 領域建模：business-rules、model、feedback
├── arch/                             # 架構決策：tech-stack、init
├── db/                               # 資料庫設計：schema
├── impl/                             # 實作執行：plan、feature、verify、fix
├── ui/                               # UI 風格：tonal-ui
├── git/                              # git 工作流：commit、pr
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
