# 起飛前檢查

`/impl:ship` 第一輪開始前跑一次。**每一項不通過，都會讓迴圈在後面某個時間點停下來**——而且通常是在做完最多工之後才停，那是最浪費的時機。

檢查順序是刻意的：環境 → 文件鏈 → 程式碼骨架 → 一次性落地。前面沒過就不要往下檢查，補完再從頭走一次。

## A. 環境

| # | 檢查 | 通過條件 | 沒過會在哪裡爆 | 怎麼補 |
|---|---|---|---|---|
| A1 | `git rev-parse --git-dir` | 在 git repo 裡 | 第一個 task 結束、`/git:commit` 建不了還原點 | `git init` |
| A2 | `git remote -v` | 有 `origin` | **做完整個 feature、驗收過，才在 `/git:pr` 第 1 步停**（repository is local-only） | 建遠端 repo 並設 origin |
| A3 | `gh auth status` | 已安裝且已登入 | 同上，`/git:pr` 第 1 步停 | 安裝 `gh` 並登入 |
| A4 | `git status --short` | 工作區乾淨 | `/impl:ship` 每輪的前置檢查停下來問 | `/git:commit` |
| A5 | `git branch --show-current` | 在 base branch 上 | `/impl:plan` 的起點分支檢查停下來問 | 切回 base 並 pull |

**A2 與 A3 最容易被忽略**，因為它們要到第一個 feature 全部做完才會發作。開跑前花一分鐘確認，比跑完一整晚才發現值得。

## B. 文件鏈

| # | 檢查 | 通過條件 | 沒過會在哪裡爆 | 怎麼補 |
|---|---|---|---|---|
| B1 | `docs/domain/business-rules/` | 至少一份 | `/impl:ship` 的 Step 0 建不出佇列，直接停 | `/domain:business-rules` |
| B2 | `docs/domain/model/` | 存在且涵蓋 B1 的規則 | `/impl:plan` 排得出 task 但沒有不變量可依據，規則會散進 controller | `/domain:model` |
| B3 | `docs/architecture/tech-stack.md` | 存在，且有「約束與慣例」與可跑的驗證指令 | `/impl:plan` 的 Step 0 抓不到 typecheck / lint / test 就停下來問 | `/arch:tech-stack` |
| B4 | `docs/db/schema.md` | **有資料庫時**必要 | `/impl:feature` 不知道不變量該由 DB 還是應用層守，兩邊都不做 | `/db:schema` |
| B5 | `docs/api/contract.md` | **有客戶端時**必要 | `/impl:plan` 的 Step 0 停（「不要自己發明端點與錯誤碼」） | `/api:contract` |
| B6 | `docs/ui/screens/` | **有畫面時**必要 | `/impl:plan` 的 Step 0 停；UI task 的驗收只寫得出「開起來看看」 | `/ui:screens` |

### 條件式項目怎麼判斷

- **B4 有沒有資料庫**：`docs/domain/model/` 有實體需要持久化就有。純計算、純代理、純 CLI 工具才沒有。
- **B5 有沒有客戶端**：模型的命令會被瀏覽器、App 或第三方呼叫就有。同一個 process 內部呼叫不算。**有行動端時 B5 是硬性的**——舊版 app 會在手機上待數個月，端點與錯誤碼不能由兩個 task 各自發明。
- **B6 有沒有畫面**：`docs/architecture/tech-stack.md` 的目標平台含 Web 或 App 就有。

判斷不出來的一律當成「有」。缺一份文件的代價是停下來補，比兩個 task 各自發明便宜得多。

### 順序相依

B5 要在 B6 之前：畫面規格要逐條走契約的錯誤碼表，決定每個錯誤在畫面上出現在哪、使用者能做什麼。

## C. 程式碼骨架

| # | 檢查 | 通過條件 | 沒過會在哪裡爆 | 怎麼補 |
|---|---|---|---|---|
| C1 | 專案是否已 scaffold | 有 `package.json` / `pyproject.toml` / `go.mod` 等，且裝得起來 | T-001 會變成「建專案」——那是 `/arch:init` 的工作，不是一個 feature task | `/arch:init` |
| C2 | 驗證指令真的跑得起來 | B3 抓到的 typecheck / lint / test / build 逐條實跑一次 | `/impl:feature` 每個 task 的驗收都會紅，但原因是指令本身不存在 | 修正 `package.json` 或 B3 的文件 |
| C3 | 有沒有「既有的相似實作」 | 至少有一個走完整分層的樣板（可以是 `/arch:init` 建的 walking skeleton） | `/impl:feature` 找不到樣板就自己發明分層、命名與測試寫法，而且每個 task 發明的不一樣 | 讓第一個 feature 的 T-001 做貫穿切片 |
| C4 | 測試分層已決定 | `docs/architecture/testing.md` 存在，且它列的每條測試指令（含 `test:integration`）實跑是綠的 | 每個 feature 都只寫 mock 資料庫的單元測試，`/impl:verify` 在層級比對時全部判成 `部分覆蓋`，或更糟——沒有 testing.md 可比對，DB 約束從來沒被驗過卻一路 `pass` | `/arch:test-strategy` |

C3 不是硬性阻塞——第一個 feature 的 T-001 本來就該是貫穿切片（`/impl:plan` 核心規則 5）。但要意識到**第一個 feature 是在定調**，它建立的分層與測試慣例會被後面所有 feature 沿用。值得在它跑完後人工看一次。

## D. 一次性落地

| # | 檢查 | 通過條件 | 沒過會在哪裡爆 | 怎麼補 |
|---|---|---|---|---|
| D1 | 資料表是否已建立 | 本機 / 開發資料庫的 schema 與 `docs/db/schema.md` 一致 | 第一個 feature 寫完程式才發現沒有資料表 | `/db:migrate` |
| D2 | UI 風格是否已宣告 | `CLAUDE.md` 或 `tech-stack.md` 寫明 `tonal-ui` / `calm-ui` / 既有設計系統 | 兩套視覺語言都會被觸發，產出互相矛盾的元件 | 在 `CLAUDE.md` 加一行 |
| D3 | **有 App 時**：模擬器跑得起來 | 開發指令（預設 iOS，如 `npx expo start --ios`）實際跑過一次、模擬器開得起來 | 每個 UI task 的驗收都卡在「開不起來」，而那要到第一個畫面做完才發現 | 裝 Xcode / 開好模擬器，指令寫進 `CLAUDE.md` |

**D1 特別注意**：`/impl:ship` 的階段表只有 `plan → feature → verify → pr`，**不包含 `/db:migrate`**。所以資料庫的落地是起飛前的一次性動作。schema 之後再變動（feature 做到一半發現要加欄位），ship 不會自己去跑 migrate——那會變成一條上游回饋或一個 `blocked` task 停下來等人。

## 一次跑完的順序

全新專案從零到可以起飛：

```
/arch:tech-stack        B3、D2（UI 風格在這一題決定）
      ↓
/arch:init              C1、C2
      ↓
/domain:business-rules  B1（每個 feature 一份）
      ↓
/domain:model           B2
      ↓
/db:schema  →  /db:migrate       B4、D1
/api:contract → /ui:screens      B5、B6
      ↓
/arch:test-strategy     C4（要讀 schema 與 contract，所以排在它們之後）
      ↓
/git:commit             A4
      ↓
/loop /impl:ship
```

`/db:*` 與 `/api:*`、`/ui:*` 兩條可以平行，它們都只依賴 B2。

## 檢查結果怎麼回報

`/impl:ship` 跑完這份檢查後，在對話中列出：

1. **通過**的項目（一行帶過即可）
2. **不通過**的項目：編號、具體現況、要跑哪個 skill
3. **不適用**的項目與理由（「純 API 專案，B6 不適用」）
4. 建議的補齊順序

有任何一項不通過就**停在這裡**，不要開始建佇列。缺著跑，只會在更晚的地方停下來，而且那時候已經有半個 feature 的產出要收拾。
