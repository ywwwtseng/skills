# 來源

`skills/` 底下的 7 個 skill 原封不動取自 [emilkowalski/skills](https://github.com/emilkowalski/skills)（MIT，授權見同目錄 `LICENSE`）。

- 上游 commit：`2d228630ba1446365f614a108cb8252f1feda202`（2026-10-11）
- 收錄：`animate`、`animate-expo`、`animation-performance`、`animation-vocabulary`、`review-animations`、`improve-animations`、`find-animation-opportunities`
- 未收錄：`emil-design-eng`、`apple-design`（含視覺風格建議，會跟 `/ui:tonal-ui`、`/ui:calm-ui` 打架）、`pick-ui-library`、`prototype`、`break-ui`、`mobile-native`、`ask-sonner`、`write-swift`（不是動畫）
- `animate` 第 3 步提到的 `pick-ui-library` 沒收錄，那一步會被跳過

## 跟本 repo 的 UI 風格怎麼分工

動畫的「要不要動、怎麼動」照這裡；顏色、字級、間距、元件外觀照該介面選定的 `/ui:tonal-ui` 或 `/ui:calm-ui`。兩邊都有 token 時，動畫 token（`--ease-*`、duration）加進該介面既有的 token 檔，不另開一套。

## 同步上游

不在這裡改 skill 內容，要改就重新同步：

```bash
git clone --depth 1 https://github.com/emilkowalski/skills /tmp/emil-skills
for s in animate animate-expo animation-performance animation-vocabulary review-animations improve-animations find-animation-opportunities; do
  rm -rf motion/skills/$s && cp -R /tmp/emil-skills/skills/$s motion/skills/
done
cp /tmp/emil-skills/LICENSE motion/LICENSE
```

同步後更新上面的 commit、`motion/.claude-plugin/plugin.json` 與 marketplace 的版本。
