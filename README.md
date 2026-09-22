# skills

ywwwtseng 的個人 Claude Code plugins。

## 安裝

在 Claude Code 中：

```
/plugin marketplace add ywwwtseng/skills
/plugin install domain@skills
/plugin install architecture@skills
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
| architecture | tech-stack | `/architecture:tech-stack` | 多輪問答選型 frontend / mobile / backend / database / infra 與架構模式，輸出 `docs/architecture/tech-stack.md` |
| architecture | init | `/architecture:init` | 讀 `docs/architecture/tech-stack.md`，把專案實際建起來：repo 骨架、官方 scaffold 指令、lint / test / 型別檢查、`.env.example`、CI、`CLAUDE.md` 約束段落，最後跑一次 typecheck / lint / test / build 驗證；不 commit、不建雲端資源、不寫 secrets；scaffold 指令表在 `architecture/skills/init/references/scaffold.md` |
| ui | tonal-ui | `/ui:tonal-ui`（也會自動載入） | 不畫框線、用底色色塊分層的 UI 風格（Gmail / Material 3 tonal surface）。做新畫面、新元件、改版或 design review 時套用；token 在 `ui/skills/tonal-ui/references/tokens.css` |
| git | commit | `/git:commit` | 檢視 `git status` / `git diff`，把待提交內容切成多個邏輯變更，逐一 stage（絕不 `git add -A` / `.` / `-u`，排除 `node_modules`、`dist`、`.env`、secrets）並建立 Conventional Commit 格式的 commit，直到沒有可提交的檔案，不 push |

## 結構

一個分類資料夾就是一個 plugin，裡面可以放多個 skill；skill 呼叫時會帶 plugin 前綴（例如 `/domain:model`）。

```
.
├── .claude-plugin/marketplace.json   # 列出所有 plugin，source 指向分類資料夾
├── domain/                           # 領域建模：business-rules、model
├── architecture/                     # 架構決策：tech-stack、init
├── ui/                               # UI 風格：tonal-ui
├── git/                              # git 工作流：commit
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

候選技術與情境對應表在 `architecture/skills/tech-stack/references/`，每層一個檔案（`frontend.md`、`mobile.md`、`backend.md`、`database.md`、`infra.md`、`architecture.md`、`scale.md`）。改完後升 `plugin.json` 與 `marketplace.json` 的 `version`。
