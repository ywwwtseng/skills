# 遷移工具

Step 0 判定工具後只讀對應段。判定順序：repo 既有的 migration 目錄 > `docs/architecture/tech-stack.md` > `package.json` / `pyproject.toml` 的依賴。

指令一律先在**本機或開發資料庫**跑（SKILL 核心規則 1）。

## 判定線索

| 看到這個 | 工具 |
|---|---|
| `drizzle.config.ts`、`drizzle/` | Drizzle Kit |
| `prisma/schema.prisma` | Prisma Migrate |
| `alembic.ini`、`migrations/versions/` | Alembic |
| `db/migrations/*.sql` + `goose` 依賴 | goose |
| `wrangler.toml` + `migrations/` | wrangler d1 |
| 只有 `*.sql` 而沒有工具 | 手寫 SQL + 自訂執行順序，照既有慣例 |

## Drizzle Kit

| 用途 | 指令 |
|---|---|
| 依 schema 產生 migration | `pnpm drizzle-kit generate` |
| 套用 | `pnpm drizzle-kit migrate` |
| introspect 現況 | `pnpm drizzle-kit pull` |
| 檢查 schema 與 DB 差異 | `pnpm drizzle-kit check` |

- schema 即 TypeScript；本文件的表名與欄位名可直接對應。
- **會漏掉**：CHECK 與部分索引要用 `sql` 模板明寫；`generate` 對「改欄位名」會判成 drop + add，一定要打開產出的 SQL 改成 `RENAME`，否則資料沒了。
- 沒有 down：回滾靠手寫反向 SQL 檔，或還原備份。不可逆的檔案照 SKILL 核心規則 4 標註。

## Prisma Migrate

| 用途 | 指令 |
|---|---|
| 產生並套用（開發） | `pnpm prisma migrate dev --name <name>` |
| 只產生不套用 | `pnpm prisma migrate dev --create-only --name <name>` |
| 套用既有 migration | `pnpm prisma migrate deploy` |
| introspect 現況 | `pnpm prisma db pull` |
| 檢查狀態 | `pnpm prisma migrate status` |

- 破壞性變更一律用 `--create-only`，打開 SQL 改成 expand-migrate-contract 再跑。
- **會漏掉**：CHECK、部分索引、`EXCLUDE`、觸發器 —— Prisma schema 表達不出來，要在產出的 `migration.sql` 手動補原生 SQL，並在 `schema.prisma` 留註解說明 DB 有一條 Prisma 看不到的約束。
- `migrate dev` 偵測到 drift 會提議 **reset（清空資料庫）**。無人看守時絕不接受：停下來問（SKILL 核心規則 1、10）。
- 沒有 down：同 Drizzle。

## Alembic

| 用途 | 指令 |
|---|---|
| 產生（自動比對 model） | `uv run alembic revision --autogenerate -m "<msg>"` |
| 套用到最新 | `uv run alembic upgrade head` |
| 回滾一步 | `uv run alembic downgrade -1` |
| 現況版本 | `uv run alembic current` |

- 有 `upgrade()` / `downgrade()` 兩段，down 一定要寫（這是少數原生支援回滾的工具，別浪費）。
- **會漏掉**：`--autogenerate` 偵測不到欄位改名（判成 drop + add）、CHECK 的變更、部分索引、伺服器端預設值。產出的 revision 一律打開改。
- 約束命名用 `naming_convention` 設定，對齊 `db/skills/schema/references/conventions.md` 的命名段。

## goose / sqlc

| 用途 | 指令 |
|---|---|
| 新增 migration | `goose -dir db/migrations create <name> sql` |
| 套用 | `goose -dir db/migrations <driver> "<dsn>" up` |
| 回滾一步 | `goose -dir db/migrations <driver> "<dsn>" down` |

- 純 SQL，`-- +goose Up` / `-- +goose Down` 分段，schema.md 可直接當 DDL 藍本。
- 不做任何自動偵測，所以不會漏掉東西——但也代表 diff 要自己算（SKILL Step 1）。
- `CREATE INDEX CONCURRENTLY` 要加 `-- +goose NO TRANSACTION`。

## wrangler d1（Cloudflare）

| 用途 | 指令 |
|---|---|
| 新增 migration | `npx wrangler d1 migrations create <db> <name>` |
| 套用到本機 | `npx wrangler d1 migrations apply <db> --local` |
| 套用到遠端 | `npx wrangler d1 migrations apply <db> --remote` |
| 查現況 | `npx wrangler d1 execute <db> --local --command "SELECT sql FROM sqlite_master"` |

- **`--remote` 就是 production**。本 skill 只跑 `--local`；`--remote` 寫進 runbook 交給人（SKILL 核心規則 1）。
- SQLite 限制照 `destructive.md` 的 SQLite 段：沒有 `ALTER COLUMN`、外鍵預設關閉。
- D1 沒有交易式 migration：一個檔案中途失敗會停在中間狀態，所以檔案要切得更小。

## 手寫 SQL

沒有工具時：依既有慣例命名（`NNNN_<描述>.up.sql` / `.down.sql` 或單檔分段），並確認有一張記錄已套用版本的表。沒有的話，在報告說明現況無法追蹤已套用狀態，建議先導入一個工具。

## 共通檢查

不論用哪個工具，產出的 migration 都要打開來看過，並核對三件事（SKILL 核心規則 8）：

1. schema.md 落點表寫「DB 約束」的每一條，是否真的出現在 SQL 裡
2. 有沒有把「改名」變成 drop + add
3. 外鍵的 `ON DELETE` 行為是否與 schema.md 一致
