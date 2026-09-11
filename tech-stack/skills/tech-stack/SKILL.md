---
name: tech-stack
description: 透過多輪問答協助使用者為新專案選型 frontend、mobile app、backend、database、infra 與專案架構模式（monorepo 等），並輸出 docs/tech-stack.md 決策文件。當使用者要開新專案不知道用什麼技術、想比較技術方案、或明確要求技術選型時使用。
---

# Tech Stack

透過結構化問答收集需求，依 `references/` 的判斷準則推薦技術棧，最後輸出決策文件。

## 核心規則

1. **每一題都必須用 `AskUserQuestion` 提問，並提供 2–4 個選項。** 禁止用純文字開放式提問。工具內建「Other」讓使用者自訂答案，不需自行加「其他」選項。
2. **先問需求，不問技術。** 不要問「React 還是 Vue」，要問「需要 SEO 嗎」。技術由你依 references 推薦。
3. **選項要有 description**，說明選了會影響什麼（例如「需要 SEO → 傾向 SSR 框架」）。
4. 每輪最多 3 題，完整模式總題數控制在 13 題以內（含模式題與確認題），快速模式 5 題以內。
5. 若使用者在自訂答案中提到明確技術偏好（例如「我們只用 Go」），視為硬限制，後續不再推薦其他。
6. 推薦時**只從 references 的候選清單中選**；使用者有特殊需求超出清單時才用自身知識補充，並在文件中標注「非標準候選」。
7. 多選題若同時勾選「無…」與其他選項，忽略「無」，以其他選項為準；不需追問。
8. 答案互相衝突時（例如規模「中型商業應用」但預算「極低」），依 `references/scale.md` 的「衝突處理」原則決定，並在文件「需求回顧」中寫明取捨。

## 流程

### Step 0：判斷模式

先用一題確認模式：

- **完整模式**：四輪問答（約 12–13 題），適合對外產品或中大型專案
- **快速模式**：使用者一句話描述專案 + 3 題關鍵問題，適合 MVP、side project、內部工具

若使用者一開始就給了詳細描述，可直接進快速模式並跳過已知的問題。

### Step 1：專案輪廓（2–3 題）

| 主題 | 選項方向 |
|---|---|
| 目標平台 | 只做 Web / Web + 行動 App / 只做行動 App / 純 API 無 UI |
| 產品類型 | 對外產品 / 內部工具 / 內容網站 / 電商・交易 |
| 預期規模 | 個人・小型 / 團隊・內部應用 / 中型商業應用 / 大型・企業級 |
| 大型系統特性（多選，僅規模選「大型」時） | 高流量 / 企業級治理 / 全球化・多區域 / 超大規模 |

規模題的選項文案與各檔位對各層的影響見 `references/scale.md`。

**語言多選的語意**：只勾 TS → 全端 TS；TS + 一個其他語言 → TS 負責 frontend / mobile，另一個負責 backend；勾了 ≥ 2 個非 TS 語言 → 追問一題 backend 用哪個；完全沒勾 TS 但有 Web / App → frontend 仍用 TS 框架，並在風險標注學習成本。

### Step 2：團隊與限制（2–3 題）

| 主題 | 選項方向 |
|---|---|
| 團隊使用的語言（多選） | TypeScript / Python / Go / Rust（Java・Kotlin 由 Other 填入） |
| Backend 語言（僅勾選 ≥ 2 個非 TS 語言時） | 從勾選的非 TS 語言中擇一 |
| TypeScript runtime（僅語言含 TS 時） | 讓 skill 推薦 / Node.js / Bun |
| 團隊規模 | 1 人 / 2–5 人 / 5 人以上 |
| 雲平台或部署限制 | 無偏好 / AWS / GCP / Vercel・Cloudflare 類 PaaS / 必須自架 or 地端 |
| 專案架構模式 | 讓 skill 推薦 / Monorepo / 單一應用 / Polyrepo |
| 合規或預算 | 無特殊限制 / 資料需落地特定區域 / 預算極低（免費層優先） |

### Step 3：功能需求（2–3 題，多選）

| 主題 | 選項方向 |
|---|---|
| Frontend 特性（有 Web 時） | 需要 SEO・SSR / 高互動 SPA / 大量表單・後台 / 幾乎無 UI |
| Mobile 特性（有 App 時） | iOS + Android 都要 / 只要單一平台 / 需要原生功能（相機・藍牙・背景定位）/ 需要離線 / 需要推播 |
| Backend 特性 | Real-time（WebSocket） / 背景任務・排程 / 重運算・AI 推論 / 檔案上傳處理 |
| 主要資料模型 | 關聯資料為主 / 簡單 CRUD・傳統 Web / 文件資料為主 / 混合・不確定 |
| 附加資料需求（多選） | Key-Value・Cache / 大量分析 / AI・Vector / 無 |

**條件式提問**：Step 1 目標平台若不含 Web，跳過 Frontend 特性題；不含 App，跳過 Mobile 特性題。

### Step 4：初版推薦與確認（1–2 題）

1. 在對話中列出各層初版推薦（一張表：層級 / 選擇 / 一句理由）。層級為 架構模式 / Frontend / (Mobile) / Backend / Database / Infra。
2. 用 `AskUserQuestion` 問「是否有哪一層要調整」，選項固定為「都接受」「架構 / Frontend / Mobile」「Backend / Database」「Infra」，選中後再細問哪一層。
3. 若有調整，針對該層再提供 2–3 個替代選項（來自 references 的「替代」欄），確認後結束。

### Step 5：輸出文件

寫入 `docs/tech-stack.md`。若檔案已存在，先用 `AskUserQuestion` 確認「覆蓋 / 另存為 `docs/tech-stack-YYYY-MM-DD.md`」。

文件格式：

```markdown
# Tech Stack Decision — <專案名>

> 產生日期：YYYY-MM-DD ｜ 模式：完整 / 快速 ｜ 規模：<檔位> ｜ 平台：<Web / Web + App / …>

## 摘要
<一段話說明整體方向與主要取捨>

| 層級 | 選擇 | 一句理由 |
|---|---|---|
| 架構 | … | … |
| Frontend | … | … |
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
- **風險 / 注意事項**：…

### Mobile（有 App 時才有此段）
（同格式，另加 **與 Web 共用**：哪些程式碼 / 型別 / API client 可共用）

### Backend
（同格式）

### Database
（同格式）

### Infra
（同格式，含 CI/CD、監控、object storage、預估月費）

## 約束與慣例
<給後續開發遵守的硬規則，每條一行：ORM、auth 方式、上傳方式、API 版本化、不要做的事>

## 整體架構
<mermaid 圖：web / mobile client → backend → db / redis，標注部署位置；有 App 時標注推播與 app store>

## 未決事項與下一步
- [ ] …
```

**架構模式與當前目錄的關係**（寫在「專案架構」）：

- 單一應用 / Monorepo：當前目錄就是該 repo，骨架直接畫在此目錄下。
- Polyrepo：當前目錄是**其中一個 repo**（通常是主要服務，依產品類型決定：Web 產品 → web、純 API → api）。「專案架構」改列「Repo 清單」表（repo 名稱 / 技術 / 負責範圍），其餘 repo 放進「未決事項」。若使用者希望當前目錄當作 workspace 父目錄，改用 Monorepo 較合理，需在對話中提醒。

輸出後在對話中簡短摘要，並建議使用者把「約束與慣例」段落複製到 `CLAUDE.md`（若專案有的話）；可再呼叫 `/tech-stack` 重跑某一層。

## 判斷準則

各層候選與情境對應表見：

- `references/scale.md`（規模檔位 → 各層傾向，每次都讀）
- `references/architecture.md`（repo 結構與服務拓撲）
- `references/frontend.md`
- `references/mobile.md`（目標平台含 App 時）
- `references/backend.md`
- `references/database.md`
- `references/infra.md`

推薦前**務必讀取對應 reference**，不要憑印象推薦。
