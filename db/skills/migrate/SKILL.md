---
name: migrate
description: 把 docs/db/schema.md 的設計變成真的 migration 檔並安全套用——先 introspect 現況算出與目標的 diff（不憑印象重建整份 schema）、把變更分成安全 / 需回填 / 破壞性三類、一個 migration 一件事且都寫得出 down、同步 ORM schema 且不因 ORM 做不到就放掉約束、只對本機或開發資料庫套用並用 up → 比對 → down → up 驗證可回滾，破壞性變更拆成 expand-migrate-contract 並只產檔不自動跑。當使用者說「寫 migration」「把 schema 建起來」「套用資料庫變更」「加個欄位到資料庫」「改型別 / 刪欄位 / 加唯一約束」時使用。設計本身要改回 /db:schema；本 skill 不碰 production、不改 schema.md、不寫業務程式碼。
---

# DB Migrate

`/db:schema` 明寫不產 migration 檔，於是整條鏈裡**最不可逆的那個動作**，落在沒有任何規範的 task 裡。本 skill 補上那一段。

其他 skill 做錯了，重跑一次就好。這個做錯了，資料沒了。所以它的核心規則比別的 skill 硬。

## 定位：設計文件與資料庫之間的那一層

- **輸入**：`docs/db/schema.md`（table 定義、約束、索引、不變量落點、遷移順序、破壞性變更段）、**資料庫的實際現況**（既有 migration 目錄、ORM schema、introspect 出來的 DDL）、`docs/architecture/tech-stack.md`（引擎、ORM / 遷移工具、環境）。
- **輸出**：migration 檔（up + down）、同步後的 ORM schema、必要的回填腳本、**已在本機 / 開發資料庫套用並驗證過**的結果，以及破壞性變更的 runbook。
- **不做**：改 `docs/db/schema.md` 的設計、對 production / staging 執行任何東西、寫業務程式碼、`git commit`（交給 `/git:commit`）。

schema.md 回答「資料庫該長什麼樣」；本 skill 回答「從現在這個樣子，怎麼安全地變成那樣，以及變不回去的時候怎麼辦」。

## 核心規則

1. **只對本機或開發資料庫執行。** 動手前先確認連線字串（`DATABASE_URL`、`.env`、wrangler 設定）指向本機或標明是 dev 的資料庫。指向 production、staging、任何雲端主機名，或**判斷不出來**，一律停下來問，不要「先試試看」。production 的套用永遠是人按下去的，本 skill 只交出 runbook。
2. **schema.md 是唯一來源。** 文件裡沒有的 table、欄位、約束，不准出現在 migration。實作需要但文件沒有的，回 `/db:schema` 補設計，不要在 migration 裡自己加一個欄位——那個欄位不會有人知道它為什麼存在。
3. **先算 diff，再寫 migration。** 目標是 schema.md，現況是**資料庫實際的樣子**（introspect，或既有 migration 全部跑完後的結果），migration 寫的是兩者的差。不要憑 schema.md 重新產生整份 CREATE TABLE——既有資料庫不是空的。
4. **一個 migration 一件事，而且寫得出 down。** 每個檔案只做一種變更（一張表、一組相關欄位、一條約束）。down 寫不出來的（刪欄位、改型別後資料已經轉換）標成**不可逆**，單獨一個檔案，並在檔頭寫明「回復方式 = 還原備份」，不要跟可逆的變更混在同一個檔案裡。
5. **破壞性變更拆成 expand → migrate → contract，contract 不自動跑。** 加 NOT NULL、改型別、改主鍵、刪欄位、加唯一約束，一律拆成多步（見 `references/destructive.md`）。expand（相容的新增）可以套用；contract（移除舊的）**只產出檔案，不執行**，因為它的前置條件是「不再讀寫舊欄位的程式碼已經部署完」，而那件事不在本 skill 的視野裡。停下來寫清楚前置條件。
6. **會動到資料的 migration，跑之前先備份。** 回填、型別轉換、刪除，套用前先 dump 一份（本機也是）。備份路徑寫進報告。
7. **套用不等於成功，要驗證。** 跑完 up 之後：introspect 比對實際 schema 與 schema.md（table、欄位型別、NULL 可空性、外鍵、唯一約束、CHECK、索引一項一項核），然後跑 **down → up** 確認可回滾且可重放。有測試資料的資料庫也要試一次。
8. **約束不能因為 ORM 做不到就放掉。** Prisma 寫不出 CHECK 與部分索引就用原生 SQL 補在 migration 裡（`references/tools.md`）。schema.md 說 DB 要擋的，DB 就要擋得住——不然 `/impl:verify` 的落點檢查會發現文件說有、實際沒有。
9. **不改 schema.md、不改模型。** 寫 migration 時發現設計有問題（型別存不下、約束互相矛盾、索引無法建立），寫進最相關的 `docs/impl/<feature>/plan.md` 的「上游回饋」表（狀態 `待處理`），交給 `/domain:feedback`，或直接建議重跑 `/db:schema`。不要自己改設計。
10. **提問必須用 `AskUserQuestion`，一次只問一題。** 只問「答錯要動資料才能補救」的問題（這個欄位既有資料怎麼回填、這張大表能不能鎖、contract 階段何時跑）。檔名格式、要不要拆兩個檔這種事自己決定。

## 流程

### Step 0：確認目標、現況與環境

1. **讀目標**：`docs/db/schema.md` 的 table 定義、不變量落點表、**遷移順序**段、**破壞性變更**段。沒有這份文件就停，說明需要先跑 `/db:schema`。
2. **確認引擎與工具**：引擎與版本從 schema.md 讀（它已經決定過了）；遷移工具從 repo 既有的 migration 目錄 > `docs/architecture/tech-stack.md` > `package.json` 判定。對應指令與檔案慣例見 `references/tools.md`。
3. **確認連線指向哪裡**（核心規則 1）。這一步沒過，後面全部不做。
4. **取得現況**：
   - 有既有 migration → 在乾淨的本機資料庫全部跑一次，得到「現況 schema」
   - 有線上開發資料庫 → introspect（`references/tools.md` 有各工具的指令）
   - 兩者都沒有 → 現況是空的，這是第一份 migration

### Step 1：算 diff

把現況與 schema.md 逐項比對，列出變更清單。每一項歸成三類：

| 類別 | 內容 | 能不能自動套用 |
|---|---|---|
| **安全** | 新增 table、新增可空欄位、新增索引、放寬 CHECK、新增預設值 | 可以 |
| **需回填** | 新增 NOT NULL 欄位、新增唯一約束、收緊 CHECK、拆表 | 可以，但要先備份並附回填腳本 |
| **破壞性** | 改型別、改主鍵、刪欄位、刪表、改欄位名 | **只產檔，不套用**（核心規則 5） |

diff 是空的 → 說明資料庫已經與 schema.md 一致，停止。不要為了有產出而重建 migration。

### Step 2：切 migration 與排序

1. 依 schema.md 的「遷移順序」段排：建表由父到子（外鍵相依），刪除反向。
2. 一個檔案一件事（核心規則 4）。檔名照工具慣例（`references/tools.md`），序號或時間戳前綴保證順序。
3. 檔頭寫追溯：這個 migration 對應 schema.md 的哪張表 / 哪條變更、來源的模型元素與 BR-ID。沿用整套文件的追溯格式。
4. 破壞性變更依 `references/destructive.md` 拆成 expand / migrate / contract 三組檔案，檔名標明階段。

### Step 3：寫 up 與 down

- 型別、enum 落地方式、索引語法照 schema.md 決定的引擎（不要混用其他引擎的語法）。
- schema.md 落點表寫「DB 約束」的每一條，都要真的出現在 migration 裡：NOT NULL、UNIQUE、CHECK、外鍵（含 `ON DELETE`）、部分索引。
- 大表建索引用非阻塞方式（PostgreSQL `CREATE INDEX CONCURRENTLY`，注意它不能在交易內）。
- SQLite / D1 沒有 `ALTER COLUMN`，改型別走「建新表 → 複製 → 換名」，見 `references/destructive.md`。
- down 寫成真的能跑的反向操作；不可逆的照核心規則 4 標註。

### Step 4：同步 ORM schema

依 `references/tools.md` 更新 ORM 的 schema 定義（Drizzle / Prisma / SQLAlchemy / sqlc），然後**回頭核對**：ORM 產出的 migration 有沒有默默漏掉 CHECK、部分索引、`ON DELETE` 行為。漏掉的用原生 SQL 補進同一個 migration（核心規則 8）。

ORM 自動產生的 migration 檔一律**打開來看過**再用。它不知道 schema.md 的落點表。

### Step 5：套用與驗證

1. 會動到資料的，先備份（核心規則 6）。
2. 跑 up。
3. **introspect 比對**：實際 schema 與 schema.md 逐項核（表、欄位、型別、NULL、外鍵、唯一、CHECK、索引）。不一致就是還沒做完，回 Step 3。
4. 跑 **down**，確認回得去；再跑一次 **up**，確認可重放。不可逆的檔案跳過這步，但要在報告寫明它沒有被回滾測試過。
5. 有測試資料的資料庫再跑一次（空資料庫會掩蓋回填與約束衝突）。
6. 跑專案既有的測試與 typecheck，確認 ORM 型別變更沒有弄壞程式碼。

### Step 6：回填腳本（需要時）

需回填的變更要附腳本，且必須：

- **冪等**：跑兩次結果一樣（中斷後可以直接重跑）
- **分批**：大表用批次 + 明確的進度條件，不要一條 UPDATE 鎖整張表
- **可驗證**：附一條「還有幾列沒回填」的查詢

回填腳本跟 migration 分開，並在 runbook 寫明執行順序。

### Step 7：破壞性變更的 runbook

contract 階段的檔案產出但不執行（核心規則 5），並寫一份 runbook 附在報告與檔頭：

1. **前置條件**：哪一版程式碼要先部署完（不再讀寫舊欄位）、資料要先回填完（附驗證查詢）
2. **執行順序**：先備份 → 跑哪個檔案 → 怎麼確認成功
3. **回滾方式**：能 down 就寫指令；不能就寫「還原備份」，並估計資料遺失範圍
4. **需不需要停機**、大概多久

### Step 8：收尾

**先做過期引用檢查**：這次的 migration 如果改了名字或移除了東西（改欄位名、改索引名、刪欄位、改列舉值），`grep -rn "<舊名>" docs/ --include="*.md"` 掃一次，找出還在引用舊名的文件（最常見的是 `docs/architecture/tech-stack.md` 的排程與選型理由、`docs/api/contract.md` 的欄位表）。逐一列出檔案與行號，標明結論有沒有受影響。**不要自己改別人的文件**（核心規則 9）。

`docs/db/schema.md` 與實際 DDL 的差異在 Step 5 已經核過；這一步核的是**文件之間**的引用。

在對話中：

1. 新增 / 修改了哪些 migration 檔與 ORM schema 檔
2. diff 摘要：安全 N 項 / 需回填 M 項 / 破壞性 K 項（逐項列出）
3. **套用了什麼、對哪個資料庫**（連線指向哪裡），以及備份放在哪
4. 驗證結果：introspect 比對過沒有、down → up 測過沒有、測試與 typecheck 結果
5. **沒有套用的破壞性變更**與它們的 runbook 摘要
6. 上游回饋（若有），建議跑 `/domain:feedback` 或重跑 `/db:schema`
6.5. **過期引用**：哪些文件還在引用被改掉的識別名（檔案 + 行號 + 結論是否受影響）
7. 下一步：`/git:commit` 提交 migration 與 ORM 變更；production 的套用由人依 runbook 執行

## 判斷準則

- `references/tools.md`：Drizzle / Prisma / Alembic / goose / wrangler d1 的檔案慣例、產生與套用指令、introspect 指令、各自會漏掉什麼（Step 0、2、4、5 必讀對應段）
- `references/destructive.md`：加 NOT NULL、改型別、改主鍵、刪欄位、改名、加唯一約束、拆併表的 expand-migrate-contract 配方，含各引擎的差異與 SQLite 無 `ALTER COLUMN` 的走法（Step 2、3、7 必讀）

## 常見失敗模式

| 症狀 | 為什麼是錯的 |
|---|---|
| 照 schema.md 直接產一份完整 CREATE TABLE | 既有資料庫不是空的；migration 寫的是 diff（核心規則 3） |
| 沒確認連線就跑 migrate | 那條連線可能指向 production，而這是唯一無法復原的錯誤（核心規則 1） |
| 一個 migration 裡加表、改欄位、刪舊欄位一起做 | 出事時回不到中間狀態，只能整批回滾（核心規則 4） |
| 直接把欄位改成 NOT NULL | 既有列有 NULL 就整個失敗；沒失敗代表你在空資料庫上測的（`references/destructive.md`） |
| contract 階段跟 expand 一起跑掉 | 舊版程式碼還在讀那個欄位，線上立刻噴錯（核心規則 5） |
| 用了 ORM 產生的 migration 沒打開看 | CHECK 與部分索引被默默放掉，落點表就變成謊言（核心規則 8） |
| 跑完 up 沒跑 down 就說完成 | 出事時才發現回不去（核心規則 7） |
| 只在空資料庫上驗證 | 回填錯誤與約束衝突全部被掩蓋（Step 5.5） |
| 寫 migration 時覺得設計不好，順手改了欄位 | schema.md 與資料庫分岔，而且沒有人知道（核心規則 9） |
