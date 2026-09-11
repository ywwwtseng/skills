# Database 候選與判斷準則

## 問題與選項文案

### Q. 主要資料模型？（單選）

| 選項 | description | 對應 |
|---|---|---|
| 關聯資料為主 | 多表關聯、交易一致性 | PostgreSQL（預設） |
| 簡單 CRUD / 傳統 Web | 資料結構單純、團隊可能已熟 MySQL | MySQL / PostgreSQL |
| 文件資料為主 | Schema 彈性、巢狀結構、快速迭代 | MongoDB |
| 混合 / 還不確定 | 先用關聯式 + JSONB，之後再分 | PostgreSQL + JSONB |

### Q. 有哪些附加資料需求？（多選）

| 選項 | description | 對應 |
|---|---|---|
| Key-Value / Cache | session、rate limit、queue、pub/sub | Redis |
| 大量分析 | 事件、log、報表、OLAP 查詢 | ClickHouse / BigQuery |
| AI / Vector | embedding 搜尋、RAG | PostgreSQL + pgvector 或 Vector DB |
| 無附加需求 | — | — |

## 候選清單

| 技術 | 定位 |
|---|---|
| PostgreSQL | 預設主庫；JSONB、FTS、pgvector 擴充 |
| MySQL | 簡單 CRUD、既有系統或團隊已熟時 |
| SQLite（Turso / libSQL） | 個人・小型、edge、極低成本 |
| MongoDB | 文件型主庫 |
| Redis（Upstash 若 serverless） | 快取、session、queue；輔助，非主庫 |
| ClickHouse | 自架或 ClickHouse Cloud 的 OLAP |
| BigQuery | GCP 上的 OLAP，無需維運 |
| Qdrant | 獨立 Vector DB，向量量大或需獨立擴展時 |
| Managed Postgres（Neon / Supabase / RDS / Cloud SQL） | 上述 Postgres 的託管形式 |

## 主庫：情境 → 推薦

| 情境 | 首選 | 替代 | 避免 |
|---|---|---|---|
| 關聯資料為主 | PostgreSQL | — | MongoDB |
| 簡單 CRUD + 團隊熟 MySQL | MySQL | PostgreSQL | — |
| 簡單 CRUD + 無偏好 | PostgreSQL | MySQL | — |
| 文件資料為主 | MongoDB | PostgreSQL JSONB（若未來可能要關聯查詢） | — |
| 混合 / 不確定 | PostgreSQL + JSONB | — | 一開始就用兩種主庫 |
| 個人・小型 + 預算極低 | Supabase / Neon 免費層 | SQLite | RDS |
| Serverless / edge backend | Neon | Turso | 自架 Postgres |
| 需要 auth + storage + realtime 一站式 | Supabase | Firebase（非標準候選） | — |
| 資料需落地特定區域 | 可指定 region 的 managed Postgres 或自架 | — | 無法指定 region 的服務 |

## 附加需求：情境 → 推薦

| 需求 | 情境 | 首選 | 替代 | 避免 |
|---|---|---|---|---|
| Key-Value / Cache | 一般 | Redis | Valkey | 用主庫做快取 |
| Key-Value / Cache | serverless / edge | Upstash Redis | Cloudflare KV | 自架 Redis |
| 大量分析 | 指定 GCP | BigQuery | ClickHouse Cloud | — |
| 大量分析 | 其他雲或自架 | ClickHouse | BigQuery（跨雲可接受時） | 在主庫跑 OLAP |
| 大量分析 | 個人・小型 | 先用 PostgreSQL，量大再拆 | DuckDB（非標準候選） | 一開始就上 ClickHouse |
| AI / Vector | 向量 < 數百萬、已用 Postgres | PostgreSQL + pgvector | — | 獨立 Vector DB |
| AI / Vector | 向量量大或需獨立擴展 | Qdrant | Pinecone（非標準候選，全託管） | — |
| AI / Vector | 主庫是 MongoDB | MongoDB Atlas Vector Search | Qdrant | — |

## 額外判斷

- 全文搜尋：預設 PostgreSQL FTS；使用者明確要求進階搜尋（typo 容錯、faceting）才推薦 Meilisearch（非標準候選）。
- 時序資料：PostgreSQL + TimescaleDB；量大歸入「大量分析」用 ClickHouse。
- ORM 建議寫在「注意事項」：TS → Drizzle（輕）或 Prisma（DX 好）；Python → SQLAlchemy 或 Django ORM；Go → sqlc 或 GORM。
- 多租戶：row-level（tenant_id + RLS），不建議 schema-per-tenant，除非合規要求。
- 規模為「大型」時另參考 `references/scale.md` 的 read replica / 分片 / multi-region 建議。
