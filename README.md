# skills

ywwwtseng 的個人 Claude Code plugins。

## 安裝

在 Claude Code 中：

```
/plugin marketplace add ywwwtseng/skills
/plugin install tech-stack@skills
/plugin install tonal-ui@skills
```

本機開發時可直接用路徑：

```
/plugin marketplace add /Users/yw/Devlopment/skills
```

## Plugins

| Plugin | 指令 | 說明 |
|---|---|---|
| tech-stack | `/tech-stack` | 多輪問答選型 frontend / mobile / backend / database / infra 與架構模式，輸出 `docs/tech-stack.md` |
| tonal-ui | 自動載入 | 不畫框線、用底色色塊分層的 UI 風格（Gmail / Material 3 tonal surface）。做新畫面、新元件、改版或 design review 時套用；token 在 `tonal-ui/skills/tonal-ui/references/tokens.css` |

## 結構

```
.
├── .claude-plugin/marketplace.json   # 列出所有 plugin
└── <plugin-name>/
    ├── .claude-plugin/plugin.json    # plugin 名稱、版本
    ├── skills/<skill-name>/SKILL.md  # skill 本體
    └── skills/<skill-name>/references/
```

## 新增 plugin

1. 建立 `<plugin-name>/.claude-plugin/plugin.json` 與 `<plugin-name>/skills/<skill-name>/SKILL.md`
2. 在 `.claude-plugin/marketplace.json` 的 `plugins` 陣列加入一筆
3. 更新 `version`，執行 `/plugin update` 即可取得

## 更新 tech-stack 的選型準則

候選技術與情境對應表在 `tech-stack/skills/tech-stack/references/`，每層一個檔案（`frontend.md`、`mobile.md`、`backend.md`、`database.md`、`infra.md`、`architecture.md`、`scale.md`）。改完後升 `plugin.json` 與 `marketplace.json` 的 `version`。
