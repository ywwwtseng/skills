# 通用慣例

這些決定一旦不統一，schema 會在半年內長出三種寫法。整份 schema 各挑一種，寫進 `docs/db/schema.md` 的「命名與通用慣例」段；既有 schema 已有慣例時一律沿用既有的。

## 命名

| 對象 | 慣例 | 例 |
|---|---|---|
| table | snake_case、複數 | `orders`、`order_items` |
| join table | 兩邊單數名依字母序 | `order_coupons` |
| 欄位 | snake_case、單數 | `total_amount` |
| 外鍵欄位 | `<被參照 table 單數>_id` | `customer_id` |
| 布林欄位 | `is_` / `has_` 開頭 | `is_archived` |
| 時間欄位 | `_at`（時間點）、`_on`（日期） | `created_at`、`due_on` |
| 主鍵 | `id` | — |
| 索引 | `idx_<table>_<欄位…>` | `idx_orders_customer_id_status` |
| 唯一索引 | `uq_<table>_<欄位…>` | `uq_orders_number` |
| 外鍵約束 | `fk_<table>_<欄位>` | `fk_orders_customer_id` |
| CHECK | `ck_<table>_<語意>` | `ck_order_items_quantity_range` |

table 與欄位名取自模型的英文識別名（`Order` → `orders`、`unitPrice` → `unit_price`），不自創縮寫。ORM 若強制 camelCase（Prisma 的預設 model 欄位）仍以 DB 端 snake_case 為準，映射交給 ORM 的 `@map`。

## 主鍵

預設 **UUIDv7 或 ULID**（時間有序、可在應用層產生、不外洩筆數）。例外：

- 明確只在單機 / 小量（SQLite、D1）且不會合併資料 → 自增整數可接受
- 值物件表、join table → 複合主鍵（擁有者 id + 區別欄位），不另加代理鍵
- 需要對外展示的編號（訂單編號）→ 另一個 `number` 欄位 + UNIQUE，不拿它當主鍵

主鍵一律不重用、不可變。模型若說某實體「身分不變」，就不要允許 UPDATE 主鍵。

## 時間

- 一律存 UTC，型別用帶時區的時間戳；顯示與「依哪個時區切日」交給應用層，欄位說明寫明時區（模型的時間規則通常寫 `Asia/Taipei`）。
- 每張表都有 `created_at`、`updated_at`（NOT NULL，預設當下），標「儲存衍生」。
- 「某事發生的時間」是業務欄位（`submitted_at`、`cancelled_at`），只在模型有這個屬性時才加，不要和 `updated_at` 混用。
- 跨日 / 期間比較的 CHECK 一律寫 `start_at < end_at`（端點含不含照模型）。

## 金額與數量

- 金額二選一，全 schema 統一：**整數最小單位**（`total_amount_minor` + `total_currency`）或**定點數**（精度足夠涵蓋規則的進位需求）。不使用浮點數。
- 幣別是獨立欄位（ISO 4217，3 碼），不要塞進同一欄位字串。
- 單一幣別的專案仍保留幣別欄位或在慣例段寫明「全系統單一幣別，不存幣別欄位」，二選一並寫理由。
- 數量、比率的單位寫進欄位名（`weight_grams`、`discount_rate`），比率用定點數並在 CHECK 限制 0..1。

## 軟刪除與封存

- 預設**硬刪**；模型關聯的「解除時機」有「保留」「不可真的消失」「稽核需要」才用軟刪。
- 軟刪欄位統一 `deleted_at`（可空時間點）；有軟刪就：所有唯一約束改為部分索引（`WHERE deleted_at IS NULL`）或加入 `deleted_at` 成複合唯一，且所有查詢預設過濾，這兩點寫進慣例段。
- 大量歷史資料用封存表（`<table>_archive`）而不是軟刪標記。

## 多租戶

- 預設 **row-level**：每張業務表加 `tenant_id`（NOT NULL）並放進每個唯一約束與主要索引的第一欄。
- 有 RLS 能力的引擎（PostgreSQL）寫明啟用 RLS 與 policy 命名；沒有就寫明「由應用層強制帶 tenant_id」並列進不變量落點表。
- 合規要求資料實體隔離時才用 schema-per-tenant 或獨立資料庫，並在假設段寫明代價（遷移要跑 N 次）。

## 並行控制

- **樂觀鎖**：會被兩個命令同時改的表加 `version`（整數，NOT NULL，預設 0），更新時 `WHERE version = ?`；落點表寫明哪些命令受保護。
- **悲觀鎖**：上限檢查、扣庫存這類「先讀再寫且不能重算」的操作用 `SELECT ... FOR UPDATE` 鎖父列，寫明鎖定順序（固定順序避免死結）。
- **冪等**：模型有「重複請求視為同一次」的規則時，加冪等鍵欄位 + UNIQUE（或獨立 `idempotency_keys` 表），標「儲存衍生」。

## 索引

每條索引在文件裡都寫成一列：`索引名 | table | 欄位（順序） | 類型 | 支援的命令 / 查詢 | 來源`。準則：

- 欄位順序：等值條件在前、範圍條件在後、排序欄位最後。
- 外鍵欄位建索引（MySQL 自動建，PostgreSQL 必須手動）。
- 唯一性不變量 → 唯一索引；帶條件 → 部分索引。
- 高選擇性優先；布林或只有兩三種值的欄位不單獨建索引，放進複合索引的後段。
- 覆蓋索引只在有明確熱查詢時加，並寫出那個查詢。
- 全文 / 向量 / JSON 路徑索引依引擎能力，見 `dialects.md`。
- 每加一條索引就問：哪個命令會用到？答不出來就不加。

## 遷移

- 文件列出遷移順序：建表依外鍵相依由父到子，刪除反向。
- 破壞性變更（改型別、改主鍵、刪欄位、既有表加 NOT NULL、加唯一約束）另列一段，每條寫：影響的表、是否需要回填、是否需要停機、回滾方式。
- 加 NOT NULL 的標準三步：先加可空欄位 → 回填 → 再加約束。
- 大表加索引寫明用非阻塞方式（PostgreSQL `CREATE INDEX CONCURRENTLY`）。
- 本 skill 不產 migration 檔；這段是給 `/db:migrate` 照著走的順序清單。
