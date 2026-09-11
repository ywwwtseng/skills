# 預期規模：選項文案與各層影響

## Q. 預期規模？（單選）

| 選項 | description |
|---|---|
| 個人 / 小型 | 個人工具、Side Project，少量使用者，單機或簡單雲端即可 |
| 團隊 / 內部應用 | 公司內部系統，數十～數千使用者，重點在權限、整合、維護性 |
| 中型商業應用 | SaaS、一般商業產品，數千～數萬使用者，需要正式監控、備份、CI/CD |
| 大型 / 企業級 | 高流量、企業核心系統、多區域或超大規模，下一題細分 |

## Q. 大型系統有哪些特性？（多選，僅上題選「大型 / 企業級」時）

| 選項 | description |
|---|---|
| 高流量 | 大量 API / Web 流量、明顯尖峰，需要 Cache、CDN、Auto Scaling |
| 企業級治理 | 多團隊、多角色、多系統整合，強調 Security、Availability、Audit、Governance |
| 全球化 / 多區域 | 全球使用者，Multi-Region / Multi-AZ，低延遲、災難復原 |
| 超大規模 | 百萬～千萬級使用者，分散式架構、水平擴展、極端尖峰 |

組合對應：企業級高流量 = 高流量 + 企業級治理；Hyperscale 全球 = 全球化 + 超大規模。

## 檔位 → 各層傾向

| 檔位 | Frontend | Backend | Database | Infra | 文件必須提及 |
|---|---|---|---|---|---|
| 個人 / 小型 | 一體化框架（Next.js） | 與前端同倉（Route Handlers / Hono） | 免費層 managed Postgres 或 SQLite | Vercel / Cloudflare / VPS | 免費層限制 |
| 團隊 / 內部應用 | Vite SPA 或 Next.js，不需 SEO | 結構化框架（NestJS / Django / Go） | Managed Postgres | Railway / Fly.io / Cloud Run | RBAC、SSO 整合、備份 |
| 中型商業應用 | Next.js / Nuxt | 結構化框架 + queue | Managed Postgres + Redis | Fly.io / Cloud Run / ECS | 監控（Sentry + metrics）、備份策略、CI/CD、staging 環境 |
| 大型 + 高流量 | 同上 + CDN、edge caching | 無狀態、可水平擴展；Go 或 NestJS | Postgres + read replica + Redis | ECS / Cloud Run / K8s + auto scaling + CDN | Cache 策略、rate limit、負載測試 |
| 大型 + 企業級治理 | 同上 | 明確分層、audit log、細粒度權限 | Postgres + RLS + audit table | AWS / GCP + IaC（Terraform）+ SSO | Security review、audit、SLA、災難復原演練 |
| 大型 + 全球化 | CDN + edge rendering | 區域部署、資料就近 | Multi-region Postgres（Aurora Global / Spanner 非標準候選）或 read replica per region | Multi-region + global load balancer | 資料一致性策略、DR、RTO/RPO |
| 大型 + 超大規模 | 同上 | 微服務或模組化單體 + 事件驅動 | 分片或 NewSQL（CockroachDB / Spanner 非標準候選）+ 專用快取層 | Kubernetes + 完整可觀測性（OpenTelemetry） | 容量規劃、混沌測試、on-call |

多選組合時取各列的聯集，衝突時以較高要求為準。

## 衝突處理

| 衝突 | 原則 |
|---|---|
| 規模 ≥ 中型 但預算極低 | 以免費層 managed 服務起步（Supabase / Neon / Upstash / Cloudflare），但只選有明確付費升級路徑者；不選 SQLite 等日後需搬遷的方案。文件「需求回顧」寫明「規模目標為 X，預算限制下先以免費層起步」，「Infra」段列預估月費與升級時機 |
| 規模 ≥ 中型 但團隊 1 人 | 監控、備份、CI/CD、staging 仍列為必須，但選平台內建或零維運方案（Sentry、平台自動備份、GitHub Actions）；不推需要專人維運的東西（K8s、自架 observability） |
| 團隊 1 人 但需要原生雙寫 / 微服務 | 排除，改用單一技術棧方案並在「風險」標注功能受限 |
| 規模「大型」但無雲偏好 | 預設 AWS 或 GCP（依分析需求：有 BigQuery 需求 → GCP），不推 PaaS |
