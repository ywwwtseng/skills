# skills

ywwwtseng 的個人 Claude Code plugins。

## 安裝

在 Claude Code 中：

```
/plugin marketplace add ywwwtseng/skills
/plugin install tech-stack@skills
/plugin install tonal-ui@skills
/plugin install commit@skills
/plugin install business-rules@skills
```

本機開發時可直接用路徑：

```
/plugin marketplace add /Users/yw/Devlopment/skills
```

## Plugins

| Plugin | 指令 | 說明 |
|---|---|---|
| tech-stack | `/tech-stack` | 多輪問答選型 frontend / mobile / backend / database / infra 與架構模式，輸出 `docs/tech-stack.md` |
| commit | `/commit` | 檢視 `git status` / `git diff`，只 stage 屬於同一邏輯變更的檔案（絕不 `git add -A` / `.` / `-u`，排除 `node_modules`、`dist`、`.env`、secrets），建立一個 Conventional Commit 格式的 commit，不 push |
| business-rules | 自動載入 | 只要描述「要解決什麼問題」與「想要什麼功能」，就推導出逐條可驗證的 business rules（定義 / 約束 / 計算 / 狀態流轉 / 權限 / 時間 / 觸發 / 例外），先推導再提問（一次只問一題，每個選項附上對規則的影響），輸出 `docs/domain/<主題>.md`；類別 checklist 與邊界條件在 `business-rules/skills/business-rules/references/` |
| tonal-ui | 自動載入 | 不畫框線、用底色色塊分層的 UI 風格（Gmail / Material 3 tonal surface）。做新畫面、新元件、改版或 design review 時套用；token 在 `tonal-ui/skills/tonal-ui/references/tokens.css` |

## 結構

```
.
├── .claude-plugin/marketplace.json   # 列出所有 plugin
└── <plugin-name>/
    ├── .claude-plugin/plugin.json    # plugin 名稱、版本
    ├── commands/<command>.md         # slash command（可選）
    ├── skills/<skill-name>/SKILL.md  # skill 本體（可選）
    └── skills/<skill-name>/references/
```

## 新增 plugin

1. 建立 `<plugin-name>/.claude-plugin/plugin.json`，再加 `commands/<command>.md`（slash command）或 `skills/<skill-name>/SKILL.md`（skill）
2. 在 `.claude-plugin/marketplace.json` 的 `plugins` 陣列加入一筆
3. 更新 `version`，執行 `/plugin update` 即可取得

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

候選技術與情境對應表在 `tech-stack/skills/tech-stack/references/`，每層一個檔案（`frontend.md`、`mobile.md`、`backend.md`、`database.md`、`infra.md`、`architecture.md`、`scale.md`）。改完後升 `plugin.json` 與 `marketplace.json` 的 `version`。
