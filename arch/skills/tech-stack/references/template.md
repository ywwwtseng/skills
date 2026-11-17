# tech-stack.md 模板

````markdown
# Tech Stack Decision — <專案名>

> 產生日期：YYYY-MM-DD ｜ 模式：完整 / 快速 ｜ 規模：<檔位> ｜ 平台：<Web / Web + App / …>

## 摘要
<一段話說明整體方向與主要取捨>

| 層級 | 選擇 | 一句理由 |
|---|---|---|
| 架構 | … | … |
| Frontend | … | … |
| UI 風格 | <介面 → 風格，例：console → tonal-ui；web、mobile → calm-ui> | … |（有 Web 或 App 時）
| Mobile | … | … |（有 App 時）
| Backend | … | … |
| Database | … | … |
| Infra | … | … |

## 需求回顧
<把問答結果整理成 constraints 清單，每條一行；有衝突的答案寫明取捨>

## 專案架構
- **Repo 結構**：Monorepo / 單一應用 / Polyrepo，附目錄骨架（只列到第二層）
- **服務拓撲**：單體 / 模組化單體 / 微服務，說明由哪個規模檔位推得
- **共用套件**：types / api-client / validation / ui 哪些抽出
- **理由與風險**

## 各層選型

### Frontend
- **選擇**：…
- **理由**：…（對應需求回顧的哪幾條）
- **替代方案**：…（何種情況下改選）
- **風險 / 注意事項**：…（含 AI agent 友善度的降權項目，若有）

### UI 風格（有 Web 或 App 時才有此段）
- **對照**（每個有畫面的介面一列）：

  | 介面 | 路徑 | 風格 | token 落點 | 理由 |
  |---|---|---|---|---|
  | Console（後台） | `apps/console` | `/ui:tonal-ui` | `apps/console/src/styles/tokens.css` | … |
  | Web | `apps/web` | `/ui:calm-ui` | `apps/web/src/styles/tokens.css` | … |
  | Mobile | `apps/mobile` | `/ui:calm-ui` | `apps/mobile/src/theme.ts` | … |

  風格選項：`/ui:tonal-ui`（console・後台・內部系統）/ `/ui:calm-ui`（消費級 AI 產品）/ 既有設計系統（附位置）/ 未決。同一套風格的多個介面可以共用一份 token 套件（例 `packages/ui-tokens`）
- **注意**：同一個介面內兩套視覺語言互斥、不混用；不同介面可以不同套。畫面規格另由 `/ui:screens` 產出，與視覺語言不重疊

### Mobile（有 App 時才有此段）
（同格式，另加 **與 Web 共用**：哪些程式碼 / 型別 / API client 可共用；以及 **本機開發平台**：預設 iOS 模擬器 + 實際的開發指令）

### Backend
（同格式）

### Database
（同格式）

### Infra
（同格式，含 CI/CD、監控、object storage、預估月費）

## 約束與慣例
<給後續開發遵守的硬規則，每條一行：ORM、auth 方式、上傳方式、API 版本化、不要做的事>
<有 UI 時，第一條固定是 UI 風格對照：**UI 風格（依介面，同一個介面內不混用）：`apps/console` → tonal-ui；`apps/web`、`apps/mobile` → calm-ui。寫某個介面的畫面前先載入它對應的 skill，顏色・字級・間距・圓角只用該介面的 token**>
<有 App 時，加一條：**行動端本機開發預設開 iOS 模擬器**，並附該技術棧的開發指令（見 `references/mobile.md`）>
<選 Expo 時，再加一條：**用 dev build 不用 Expo Go；新增或升級原生依賴後先 `npx expo run:ios` 重建 binary 再開**（理由見 `references/mobile.md`）>

## 整體架構
<mermaid 圖：web / mobile client → backend → db / redis，標注部署位置；有 App 時標注推播與 app store>

## 未決事項與下一步
- [ ] …
````
