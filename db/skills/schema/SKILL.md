---
name: schema
description: 把概念層 domain model 轉成可直接寫 migration 的資料庫 schema（docs/db/schema.md）：table、欄位型別、鍵、約束、索引、不變量落點。當使用者說「建 DB schema」「把 model 轉成資料表」「設計 table / 欄位 / 索引」「資料庫怎麼存」時使用。要釐清的是領域概念而不是儲存方式，用 /domain:model。
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
6. **識別名一旦被別的文件引用，改名就是對外的改動。** table、欄位、索引、約束的名字會被 `docs/architecture/tech-stack.md`（排程掃哪個索引、選型理由）、`docs/api/contract.md`、程式碼與 migration 引用。改名或移除時，Step 7 要回頭掃一次那些引用——下游改了不會有人回頭更新上游，過期的引用會一直安靜地躺著，直到有人照著它實作才發現。
7. **不改模型。** schema 設計過程發現模型有矛盾或缺口（狀態機少一個轉換、關聯基數不合理），寫進「模型回饋」段並在摘要中提出，不要自己在 schema 裡改掉定義。
8. **提問必須用 `AskUserQuestion`，一次只問一題。** 只問結構性歧義；挑題條件與每題寫法見 Step 5。
9. **每個索引都要有理由。** 理由只能來自：唯一性不變量、命令或 policy 的查詢路徑、外鍵、模型寫明的排序 / 篩選需求。想不出具體查詢就不要建索引；反過來，模型裡每個會用識別碼以外條件查詢的命令，都要檢查有沒有對應索引。

## 流程

### Step 0：讀模型、現況與引擎

1. 讀 `docs/domain/model/README.md`：聚合表、跨聚合關聯、跨聚合 policy、追溯表。沒有 `docs/domain/model/` 時不要憑一句話建表——說明需要先有模型，建議先跑 `/domain:model`，然後停止。
2. 讀全部聚合檔與 `shared.md`，整理出四張清單：**實體**（含聚合歸屬、屬性、狀態機）、**值物件**（含相等性、使用者）、**列舉**（含值與終態）、**關聯**（含基數、擁有權、跨聚合與否）。另外把所有 **不變量**（INV）與 **policy**（POL）單獨列一張表，Step 4 要逐條指派落點。
3. 盤點既有 schema（核心規則 5）：既有 table 名、欄位名、命名風格（snake_case / camelCase）、主鍵策略、時間戳慣例，一律沿用。
4. 決定 DB 引擎與版本：使用者指定 > repo 既有 migration / ORM 設定 > `docs/architecture/tech-stack.md` 的 Database 段（存在就直接採用，不重問） > 用 `AskUserQuestion` 問一題。同時確認是關聯式還是文件型，這決定 Step 1 的落地方式。

### Step 1：決定落地結構

讀 `references/mapping.md`（總表、「值物件的三種落法」「狀態機的落地」），逐一決定每個模型元素的落點：

1. **聚合 → table 邊界**：聚合是交易邊界、不是 table；哪些表在同一個交易內寫入，記進該表的「交易邊界」欄。
2. **值物件 → 內嵌欄位 / 獨立表 / JSON**。
3. **列舉 → 原生 enum / 文字 + CHECK / 對照表**：引擎能力見 `references/dialects.md`。同一份 schema 只用一種做法。
4. **繼承 / 變體**：模型若有同一概念的多種型態，決定單表 + 型別欄位、每型態一表、或共用表 + 擴充表，寫明理由與取捨。
5. **狀態機 → 現值欄位（+ 可選的歷史表）**：要不要歷史表無法從模型判斷時，用 `AskUserQuestion` 問。

### Step 2：欄位與型別

逐表列欄位，概念型別照 `references/mapping.md` 的型別表轉成 `references/dialects.md` 的引擎型別：

- 模型沒標「可選」的一律 NOT NULL；可選的把模型寫的「沒有值代表什麼」寫進欄位說明。
- 衍生屬性存或不存照 mapping.md 總表；存就寫明由誰維護、何時重算。
- 金額、數量、時間與慣例欄位（主鍵、建立 / 更新時間、樂觀鎖版本、租戶欄位，標「儲存衍生」）照 `references/conventions.md` 的統一做法，不逐表各自決定。

### Step 3：鍵、關聯與索引

依 `references/mapping.md` 的「關聯 → 鍵」「不變量 → 約束」與 `references/conventions.md` 的主鍵、索引段，產出：

1. **主鍵**：全 schema 統一一種策略。
2. **外鍵**：每條關聯的外鍵位置、NULL 可空性與 `ON DELETE`；跨聚合的關聯是否建實體外鍵要明確決定並寫理由。
3. **唯一約束與 CHECK**：模型每條唯一性不變量對應一個 UNIQUE（帶條件的用部分索引，引擎不支援時寫明改由應用層守）；能寫成 CHECK 的都寫。
4. **索引**：逐條寫「索引 → 支援哪個命令 / policy / 查詢」（核心規則 9）。

### Step 4：不變量落點與生命週期

1. 把 Step 0 整理的 INV / POL 逐條填進落點表（欄位見 `references/template.md`，落點怎麼選見 mapping.md「不變量 → 約束」）。一條都不能缺（核心規則 3）。
2. **並行**：列出哪些命令會競爭同一列（狀態轉換、扣庫存、上限檢查），照 conventions.md「並行控制」指定樂觀鎖或悲觀鎖，寫明交易隔離級別的要求。
3. **生命週期**：刪除策略照 conventions.md「軟刪除與封存」，全 schema 統一。
4. **事件與副作用**：要不要 outbox 表照 mapping.md 總表的「領域事件」列。

### Step 5：釐清（有結構性歧義才做）

只挑同時符合以下條件的問題：

- 不同選擇會產生**不同的 table 結構**（多一張表、主鍵不同、欄位攤平還是 JSON），不只是型別寬度或索引差異
- 從模型、既有 schema、引擎能力**推不出**明顯較合理的一邊
- 選錯後要**改資料**才能補救（不是加一個欄位就好）

常見值得問的：值物件內嵌還是獨立表、狀態歷史要不要存、多租戶怎麼隔離。型別寬度、索引名稱這類改一行就好的事不問，標「假設」直接寫。

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

**先做過期引用檢查**（核心規則 6）：列出這次**改名、移除或改變存在性**的識別名（table、欄位、索引、約束、列舉值），對每一個 `grep -rn "<舊名>" docs/ --include="*.md"`（排除 `docs/db/schema.md` 自己）。找到的逐一列出檔案與行號，並判斷**結論有沒有受影響**：

- 只是引用過期、結論不變（例如選型理由少了一個例子但其他例子仍成立）→ 報告時寫明「結論不變」，交給使用者或對應 skill 一行修掉。
- 結論受影響（例如那個能力正是選這個引擎的唯一理由）→ 寫進「模型回饋」段並在摘要明確提出，建議重跑對應的 skill。

**不要自己去改別人的文件**（核心規則 7 的同一個理由：每份文件只有一個作者）。這次沒有改名就跳過這步。

在對話中照 `references/template.md` 的「對話中的摘要格式」回報（含「過期引用」那一行）。

## 判斷準則

- `references/mapping.md`：模型元素 → schema 元素的對應細則、概念型別 → 欄位型別、關聯 → 鍵、不變量 → 約束、常見錯誤（Step 1–4 必讀）
- `references/conventions.md`：命名、主鍵、時間、金額、軟刪除、多租戶、並行、索引與遷移的統一慣例（Step 2–4 必讀）
- `references/dialects.md`：PostgreSQL / MySQL / SQLite（D1・Turso）/ MongoDB 的型別表與能力差異（Step 0 決定引擎後必讀對應段）
- `references/template.md`：`docs/db/schema.md` 的輸出模板與對話摘要格式（Step 6、7 必讀）

設計前**務必讀取對應 reference**，不要憑印象轉換型別或決定落地方式。
