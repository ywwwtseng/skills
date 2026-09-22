# 引擎差異

Step 0 決定引擎與版本後，只讀對應段落；全份 schema 的型別與語法都屬於同一個引擎。

## 型別對照

| 概念型別 | PostgreSQL | MySQL 8 | SQLite（D1 / Turso） | MongoDB |
|---|---|---|---|---|
| 識別碼（UUID/ULID） | `uuid` / `text` | `binary(16)` / `char(26)` | `text` | `ObjectId` 或 `string` |
| 識別碼（自增） | `bigint generated always as identity` | `bigint auto_increment` | `integer primary key` | 不建議 |
| 文字 | `text` | `varchar(n)` / `text` | `text` | `string` |
| 整數 | `integer` / `bigint` | `int` / `bigint` | `integer` | `int` / `long` |
| 定點數 | `numeric(p,s)` | `decimal(p,s)` | `text` 或整數最小單位 | `Decimal128` |
| 布林 | `boolean` | `tinyint(1)` | `integer` 0/1 | `bool` |
| 時間點 | `timestamptz` | `datetime(6)`（存 UTC） | `text` ISO8601 或 `integer` epoch | `Date` |
| 日期 | `date` | `date` | `text` | `Date`（切日交應用層） |
| 列舉 | 原生 `enum` 或 `text` + CHECK | `enum` 或 `varchar` + CHECK | `text` + CHECK | `string` + JSON Schema |
| JSON | `jsonb` | `json` | `text`（`json_*` 函式） | 原生巢狀文件 |
| 陣列 | `type[]`（慎用） | 無，用表 | 無，用表 | 原生陣列 |
| 期間 | `tstzrange` + 排他約束 | 兩欄 + CHECK | 兩欄 + CHECK | 兩欄位 |
| 向量 | `vector`（pgvector） | 無（用外部） | 無 | Atlas Vector Search |

## PostgreSQL

- 列舉預設 **`text` + CHECK**：加值只要改 CHECK，原生 `enum` 加值容易、刪值與改順序很麻煩；值由使用者維護時改用對照表。
- 部分索引（`WHERE`）、運算式索引、`EXCLUDE` 約束可用，帶條件的唯一性直接落在 DB。
- 時間一律 `timestamptz`；`timestamp`（無時區）不要用。
- 外鍵欄位要手動建索引。
- 排程 policy 的「跑批」查詢通常需要 `(status, next_run_at)` 這類複合部分索引。
- 大小寫不敏感比對用 `citext` 或 `lower()` 運算式唯一索引，二選一寫進慣例段。

## MySQL 8

- 一律 `utf8mb4` + `utf8mb4_0900_ai_ci`（或明確選 `_bin` 做區分大小寫），照慣例段寫死。
- **沒有部分索引**：帶條件的唯一性改用應用層檢查 + 適當隔離級別，或用「生成欄位 + 唯一索引」的技巧（在文件寫明）。
- CHECK 從 8.0.16 起才真正生效，寫明版本要求。
- 時間存 UTC 的 `datetime(6)`；`timestamp` 有 2038 上限與時區轉換行為，不用。
- 外鍵欄位會自動建索引；不要重複建。
- JSON 欄位可用生成欄位 + 索引補查詢能力。

## SQLite / Cloudflare D1 / Turso

- 型別是動態的，但仍要寫明宣告型別並全程一致；布林用 `integer` 0/1。
- 有 CHECK、部分索引、`WITHOUT ROWID`；**沒有原生 enum、沒有 `ALTER COLUMN`**，改型別要走「建新表 → 複製 → 換名」，破壞性變更段要寫明。
- 外鍵預設關閉，寫明連線需 `PRAGMA foreign_keys = ON`（D1 用 `defer_foreign_keys` 的限制也要寫）。
- D1：單一資料庫大小上限與單 region 寫入，schema 設計避免超大表與跨 region 一致性假設；批次寫入用 `batch`。
- 時間存 ISO8601 文字（可排序）或 epoch 整數，全 schema 統一。

## MongoDB

- 落地單位是 collection 而不是 table；**聚合通常就是一個 document**：聚合內的值物件與小集合內嵌，跨聚合用識別碼參照。
- 內嵌 vs 參照：內嵌陣列會成長到無上限（訂單的操作紀錄）就改參照，避免 document 大小上限。
- 不變量落點：用 JSON Schema validator（必填、型別、值域、enum）；跨 document 的規則交給應用層與交易（replica set 才有多 document 交易）。
- 唯一性用唯一索引；帶條件的唯一用 partial index。
- 命名沿用同一套慣例，但欄位用 camelCase 較貼近生態，二選一寫進慣例段。
- 文件的「Table 定義」段改寫成 collection + document 結構（欄位 / 型別 / 必填 / 內嵌或參照 / 來源）。

## ORM 注意事項

| ORM | 注意 |
|---|---|
| Drizzle | schema 即 TypeScript；本文件的表名、欄位名可直接對應。部分索引、CHECK 需用 `sql` 模板 |
| Prisma | `@map` / `@@map` 對應 snake_case；CHECK 與部分索引要用 migration 手寫 SQL；MongoDB 支援子集功能 |
| SQLAlchemy / Alembic | 約束命名慣例用 `naming_convention` 設定，和本文件的命名段對齊 |
| sqlc / goose | SQL 為主，本文件可直接當 DDL 藍本 |

ORM 的能力不決定 schema 設計；做不到的部分寫進遷移段用原生 SQL 補，不要為了遷就 ORM 放掉約束。
