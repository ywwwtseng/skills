---
name: schema
description: 把 docs/domain/model/ 的概念層 domain model 轉成可直接寫 migration 的資料庫 schema，輸出單一份 docs/db/schema.md——table / collection、欄位與型別、主鍵外鍵、唯一約束、CHECK、索引、列舉落地方式、每條不變量的執行落點、遷移順序，每個 table 與欄位都追溯回模型元素與規則 ID。當使用者說「建 DB schema」「把 model 轉成資料表」「設計 table / 欄位 / 索引」「要開始寫 migration」「資料庫怎麼存」時使用。若使用者要釐清的是領域概念（有哪些 entity / value object）而不是儲存方式，用 /domain:model。
---

# DB Schema

把 `docs/domain/model/` 的概念層模型，落成一份 AI agent 可以直接據此寫 migration 與 ORM 定義的資料庫 schema。

## 定位：模型與 migration 之間的那一層

- **輸入**：`docs/domain/model/`（`README.md` 的追溯表與聚合表、各聚合檔、`shared.md`）。模型是唯一的內容來源；規則文件只在需要確認某條規則的原文時回頭查。
- **輸出**：單一檔案 `docs/db/schema.md`。模型依聚合分檔，schema 不分檔——schema 的價值在於一次看見所有 table、外鍵與索引。
- **不做**：實際的 migration 檔、ORM 程式碼（Prisma / Drizzle schema）、API 型別、查詢執行計畫調校。本 skill 只產出設計文件，migration 與 ORM 檔案由 `/db:migrate` 產生並套用。

模型回答「領域裡有哪些東西、守哪些規則」；schema 回答「這些東西怎麼存、規則由誰執行」。分開的意義是：模型變了才動 schema，schema 為了效能做的取捨不反過來改模型。

## 核心規則

1. **模型是唯一事實來源。** schema 不得憑空新增模型沒有的概念。純儲存需要的東西（join table、outbox、快照表、序號表）可以加，但必須在該 table 標「儲存衍生」並寫明為什麼非加不可；業務概念缺漏則回報使用者，建議先回 `/domain:model` 補模型，不要在 schema 層補。
2. **雙向追溯。** 每個 table、每個欄位的「來源」欄要指回模型元素（`order.md#Order.status`）或標「儲存衍生」；模型的每個實體、值物件、列舉、關聯、不變量都要能在「落點」表找到去處，找不到的列進「未落地」並寫原因，不默默略過。規則 ID 沿用模型的 `<規則文件 slug>/BR-XXX-nnn`。
3. **每條不變量都要有執行落點。** 落點只有三種：DB 約束（NOT NULL / UNIQUE / CHECK / FK / 部分索引）、應用層（交易內檢查、樂觀鎖）、兩者都有。能被 DB 擋住的一律放 DB；只能在應用層守的（跨聚合、需要讀多列、需要外部資料）寫明「在哪個命令的交易內檢查」與「並行時怎麼辦」。落點寫「無」等於這條規則沒人守，不允許。
4. **先定 DB 引擎與版本，再定型別。** 沒有引擎就沒有型別表、沒有 enum 能力、沒有部分索引可用。引擎未知時用 `AskUserQuestion` 問一題，不要先寫 PostgreSQL 型別再換。
5. **既有 schema 優先。** `docs/db/schema.md`、migration 目錄（`migrations/`、`prisma/schema.prisma`、`drizzle/`）、線上 DDL 若存在，它們就是現況：沿用既有 table 名與欄位名、只做增量，變動記進「變更紀錄」。會造成資料遺失或需要停機的變更（改型別、刪欄位、加 NOT NULL 到既有表、改主鍵）另列進「破壞性變更」段，寫明回填步驟，不混在一般變更裡。
6. **不改模型。** schema 設計過程發現模型有矛盾或缺口（狀態機少一個轉換、關聯基數不合理），寫進「模型回饋」段並在摘要中提出，不要自己在 schema 裡改掉定義。
7. **提問必須用 `AskUserQuestion`，一次只問一題。** 只問「不同答案會產生不同 table 結構」的問題（值物件內嵌還是獨立表、狀態歷史要不要存、多租戶怎麼隔離）。型別寬度、索引名稱這類改一行就好的事不要問，標「假設」直接寫。
8. **每個索引都要有理由。** 理由只能來自：唯一性不變量、命令或 policy 的查詢路徑、外鍵、模型寫明的排序 / 篩選需求。想不出具體查詢就不要建索引；反過來，模型裡每個會用識別碼以外條件查詢的命令，都要檢查有沒有對應索引。

## 流程

### Step 0：讀模型、現況與引擎

1. 讀 `docs/domain/model/README.md`：聚合表、跨聚合關聯、跨聚合 policy、追溯表。沒有 `docs/domain/model/` 時不要憑一句話建表——說明需要先有模型，建議先跑 `/domain:model`，然後停止。
2. 讀全部聚合檔與 `shared.md`，整理出四張清單：**實體**（含聚合歸屬、屬性、狀態機）、**值物件**（含相等性、使用者）、**列舉**（含值與終態）、**關聯**（含基數、擁有權、跨聚合與否）。另外把所有 **不變量**（INV）與 **policy**（POL）單獨列一張表，Step 4 要逐條指派落點。
3. 盤點既有 schema（核心規則 5）：既有 table 名、欄位名、命名風格（snake_case / camelCase）、主鍵策略、時間戳慣例，一律沿用。
4. 決定 DB 引擎與版本：使用者指定 > repo 既有 migration / ORM 設定 > `docs/architecture/tech-stack.md` 的 Database 段（存在就直接採用，不重問） > 用 `AskUserQuestion` 問一題。同時確認是關聯式還是文件型，這決定 Step 1 的落地方式。

### Step 1：決定落地結構

讀 `references/mapping.md`，依序決定：

1. **聚合 → table 邊界**：聚合不是 table。聚合根是一張表；聚合內的實體各自一張表，以外鍵指回聚合根；聚合內的值物件依下一條決定。聚合邊界的意義在 schema 層是「同一個交易內寫入」，記進該表的「交易邊界」欄。
2. **值物件 → 內嵌欄位 / 獨立表 / JSON**：單一值（金額、期間）攤平成該表的多個欄位並加前綴（`total_amount`、`total_currency`）；集合型（訂單項目）開獨立表；結構不固定、且不會被單獨查詢或約束的才用 JSON，並寫明不能對它下 CHECK 與索引的後果。
3. **列舉 → 原生 enum / 文字 + CHECK / 對照表**：依引擎能力與「值會不會由使用者新增」決定，見 `references/dialects.md`。同一份 schema 只用一種做法。
4. **繼承 / 變體**：模型若有同一概念的多種型態，決定單表 + 型別欄位、每型態一表、或共用表 + 擴充表，寫明理由與取捨。
5. **狀態機 → 現值欄位（+ 可選的歷史表）**：現值一律一個欄位。模型的狀態轉換若帶有「誰在什麼時候做的」而且規則需要回查，才加歷史表；這題若無法從模型判斷，用 `AskUserQuestion` 問。

### Step 2：欄位與型別

逐表列欄位，依 `references/mapping.md` 的概念型別表與 `references/dialects.md` 的引擎型別表轉換：

- 模型的「可選〈型別〉」→ NULL 可空；模型寫明「沒有值代表什麼」就一併寫進欄位說明。模型沒標可選的一律 NOT NULL。
- 模型的「衍生屬性」→ 決定存（凍結值、加速查詢）或不存（查詢時算）。存就寫明由誰維護、何時重算；模型若寫「成立時凍結」一律存。
- 金額、數量、時間一律照 `references/conventions.md` 的統一做法（單位、精度、時區），不逐表各自決定。
- 每張表補上慣例欄位（主鍵、建立 / 更新時間、樂觀鎖版本、租戶欄位），這些標「儲存衍生」。

### Step 3：鍵、關聯與索引

1. **主鍵**：依 `references/conventions.md` 的策略統一（預設 UUIDv7 / ULID，必要時自增）；值物件表與 join table 可用複合主鍵。
2. **關聯 → 外鍵**：`1 → 0..*` 在「多」的那一側放外鍵欄位；`0..1 → 1` 依擁有權決定；`*..*` 開 join table。每條外鍵寫明 `ON DELETE`（沿用模型關聯的「對方消失時」：保留識別碼 → `SET NULL` 或不建外鍵、禁止刪除 → `RESTRICT`、一併刪除 → `CASCADE`）。跨聚合的關聯是否建實體外鍵要明確決定並寫理由（同庫通常建；跨服務 / 跨庫不建，改由應用層守）。
3. **唯一約束**：模型每條唯一性不變量對應一個 UNIQUE（含範圍：全域或某父實體內 → 複合唯一）。帶條件的唯一（「進行中的訂單才唯一」）用部分索引，引擎不支援時寫明改用應用層 + 交易隔離級別。
4. **CHECK**：範圍、列舉、長度、欄位間關係（`start_at < end_at`）能寫成 CHECK 的都寫。
5. **索引**：逐條寫「索引 → 支援哪個命令 / policy / 查詢」，格式見 `references/conventions.md` 的索引段。外鍵欄位預設建索引（MySQL 自動建，PostgreSQL 要自己建）。

### Step 4：不變量落點與生命週期

1. 把 Step 0 整理的 INV / POL 逐條填進落點表：ID、陳述摘要、落點（DB / 應用層 / 兩者）、實作方式（NOT NULL、UNIQUE、CHECK、部分索引、交易內檢查、樂觀鎖…）、檢查時機、違反時的行為。一條都不能缺（核心規則 3）。
2. **並行**：列出哪些命令會競爭同一列（狀態轉換、扣庫存、上限檢查），指定樂觀鎖（version 欄）或悲觀鎖（`SELECT FOR UPDATE`），寫明交易隔離級別的要求。
3. **生命週期**：刪除策略（硬刪 / 軟刪 / 封存）依模型關聯的「解除時機」決定，全 schema 統一；有軟刪就檢查所有唯一約束是否要排除已刪除列。
4. **事件與副作用**：模型的領域事件若有 policy 需要可靠送達，加 outbox 表（標「儲存衍生」）；只是記錄則不建表。

### Step 5：釐清（有結構性歧義才做）

只挑同時符合以下條件的問題：

- 不同選擇會產生**不同的 table 結構**（多一張表、主鍵不同、欄位攤平還是 JSON），不只是型別寬度或索引差異
- 從模型、既有 schema、引擎能力**推不出**明顯較合理的一邊
- 選錯後要**改資料**才能補救（不是加一個欄位就好）

依補救成本排序，一題一題用 `AskUserQuestion` 問。每題：`question` 說明是哪個模型元素造成的歧義；`options` 2–4 個，第一個標「(Recommended)」；`description` 格式為「schema：〈table 會長怎樣〉／影響：〈查詢、約束、之後要改時的代價〉」。

範例：

```
question: "order.md 的 OrderItem 是 Order 聚合內的值物件，模型說它隨訂單生滅。要開獨立表還是存成 Order 的 JSON 欄位？"
options:
  - label: "獨立表 order_items (Recommended)"
    description: "schema：order_items 以 order_id 外鍵指回 orders，數量與單價各自成欄位／影響：可對 quantity 下 CHECK、可依商品查詢與統計；寫入訂單時多一次批次 insert"
  - label: "orders.items JSON 欄位"
    description: "schema：整包項目存在 orders.items／影響：讀寫訂單一次搞定；但 INV-ORD-006（quantity 1..99）無法用 CHECK 守、無法依商品查訂單，之後要拆表得回填全部資料"
```

### Step 6：輸出文件

格式見 `references/template.md`，寫入 `docs/db/schema.md`（既有檔案採合併，沿用既有表名與欄位名，變動記進「變更紀錄」，破壞性變更另列）。

寫完做四個檢查：

1. **追溯完整性**：每張表、每個非慣例欄位都有來源；模型的每個實體、值物件、列舉、關聯都出現在「模型落點表」，未落地的有原因。
2. **不變量完整性**：模型全部 INV / POL 都在落點表，沒有落點寫「無」的。
3. **關聯完整性**：模型每條關聯都對應到外鍵、join table 或「應用層維護」的明確決定，基數與 NULL 可空性一致（`1 → *` 的外鍵必須 NOT NULL）。
4. **引擎一致性**：全文型別、索引語法、enum 做法都屬於 Step 0 決定的那個引擎與版本；沒有混用其他引擎的語法。

### Step 7：收尾

在對話中：

1. 列出寫入 / 修改的檔案與這次動了什麼
2. 摘要 schema 規模：table 數、欄位數、外鍵數、唯一約束數、索引數、CHECK 數
3. 不變量落點統計：DB 擋 N 條 / 應用層 M 條 / 未落地 K 條
4. 列出最值得確認的 3 個設計假設，以及破壞性變更（若有）
5. 列出「模型回饋」（模型的矛盾或缺口，若有），建議回 `/domain:model` 處理
6. 下一步：`/db:migrate` 依本文件產生 migration 與 ORM schema 並套用到本機驗證；模型改了就重跑 `/db:schema` 增量更新，不要直接改 migration 反推

## 判斷準則

- `references/mapping.md`：模型元素 → schema 元素的對應細則、概念型別 → 欄位型別、關聯 → 鍵、不變量 → 約束、常見錯誤（Step 1–4 必讀）
- `references/conventions.md`：命名、主鍵、時間、金額、軟刪除、多租戶、並行、索引與遷移的統一慣例（Step 2–4 必讀）
- `references/dialects.md`：PostgreSQL / MySQL / SQLite（D1・Turso）/ MongoDB 的型別表與能力差異、ORM 注意事項（Step 0 決定引擎後必讀對應段）
- `references/template.md`：`docs/db/schema.md` 的輸出模板與對話摘要格式（Step 6、7 必讀）

設計前**務必讀取對應 reference**，不要憑印象轉換型別或決定落地方式。
