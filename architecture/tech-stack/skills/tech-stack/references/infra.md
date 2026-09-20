# Infra 候選與判斷準則

## 候選清單（窄範圍）

| 技術 | 定位 |
|---|---|
| Vercel | Next.js 原生平台，零設定 |
| Cloudflare（Workers + D1 / KV / R2 / Queues / Durable Objects） | Edge 優先，免費層慷慨，可作 TS 全端一站式平台；適合 Hono / Astro，Next.js 需經 OpenNext adapter |
| Fly.io | 容器即服務，接近 VPS 的彈性但免運維；**無免費層**，最小配置約 $5 / 月 |
| Railway / Render | 簡單 PaaS，git push 部署，含 DB；Railway Hobby $5 / 月，Render 有免費層但會休眠 |
| AWS（ECS / Lambda + RDS） | 企業級、完整生態、設定面較廣 |
| GCP（Cloud Run + Cloud SQL） | 容器 serverless 體驗最好 |
| VPS + Docker Compose（Hetzner / DO） | 最低成本、完全掌控、需自己運維 |
| Kubernetes | 只在多服務 + 規模為大型時 |

## 情境 → 推薦

| 情境 | 首選 | 替代 | 避免 |
|---|---|---|---|
| Next.js + 無雲偏好 | Vercel | Cloudflare（`@opennextjs/cloudflare`，非標準候選） | AWS（過重） |
| 指定 Cloudflare 或 預算極低 + TS 全端 | Cloudflare 全端（見下節） | Vercel + Neon | — |
| Backend runtime 選 Bun | Fly.io 或 Railway（Dockerfile `oven/bun`） | Cloud Run | Vercel functions / Cloudflare Workers（runtime 非 Bun） |
| Hono / Astro / edge 導向 | Cloudflare | Vercel | — |
| 需要長連線（WebSocket）、背景 worker | Fly.io | Railway；Cloudflare Durable Objects + Queues（已在 Cloudflare 時） | Vercel（serverless 限制） |
| Go / Rust / Python 容器化服務、中型以下 | Fly.io 或 Railway | Cloud Run | Kubernetes |
| 指定 AWS | ECS Fargate + RDS | Lambda（若純 API 且冷啟動可接受） | 自建 EC2 集群 |
| 指定 GCP | Cloud Run + Cloud SQL | GKE Autopilot | — |
| 預算極低、可接受自己運維 | VPS + Docker Compose（Hetzner 約 €4 / 月） | Fly.io | 任何 managed K8s |
| 預算極低、不想運維、純靜態或 edge 可跑 | Cloudflare Pages / Workers（免費層） | Vercel Hobby | — |
| 預算極低、需要容器（Bun / WebSocket / worker） | Fly.io（約 $5 / 月，標注非免費） | Render 免費層（會休眠，WebSocket 不穩） | — |
| 必須地端 / 自架 | VPS 或內部 VM + Docker Compose | K3s（若多服務） | 完整 Kubernetes |
| 企業級、多服務、大型規模 | Kubernetes（EKS / GKE） | ECS | — |

## Cloudflare 全端方案

指定 Cloudflare、或「預算極低 + TS + 不想運維」時，整套都在 Cloudflare 上，一個 `wrangler.toml` 管所有資源：

| 需求 | Cloudflare 元件 | 說明 / 限制 |
|---|---|---|
| Backend API | Workers + Hono | `wrangler dev` 直接跑 TS，免 build；CPU time 限制見 backend.md |
| 前端靜態 / SSR | Workers Static Assets（Astro、Vite SPA）；Next.js 走 `@opennextjs/cloudflare` | Pages 已被 Workers Static Assets 取代，新專案不用 Pages |
| 關聯資料 | D1（SQLite） | 單 DB 10 GB、單一 region 寫入；規模 ≥ 中型改 Neon（HTTP driver）或 Hyperdrive 接任何 Postgres |
| KV / Cache | KV | 最終一致（全球同步約 60 s），不適合強一致計數；強一致用 Durable Objects |
| Object storage | R2 | S3 相容 API、無 egress 費 |
| 背景任務 | Queues + Cron Triggers | 取代 BullMQ；不需要 Redis |
| WebSocket / 即時協作 / 每個房間一個狀態 | Durable Objects | 內建 SQLite storage、Hibernation API 降低連線費用 |
| AI / Vector | Vectorize + Workers AI | 向量量大或需要特定 embedding 模型時改 pgvector / Qdrant |
| Auth | 無內建；用 Better Auth（D1 adapter）或 Clerk | — |

**適用**：個人・小型、內部工具、中型且流量分散全球的 TS 專案。
**不適用**：重運算或長時間 CPU（媒體轉檔、大批次）、需要 Postgres 進階功能（RLS、複雜交易）且量大、非 TS 後端——這些改用容器平台，Cloudflare 只留 CDN / R2。

## 免費層現況（推薦時要寫進「預估月費」）

| 服務 | 免費層 |
|---|---|
| Cloudflare Workers | 有，每日 100k 請求；D1 5 GB / KV 1 GB / R2 10 GB 免費；Durable Objects 與 Queues 需 Workers Paid（$5 / 月） |
| Vercel Hobby | 有，僅限非商業用途 |
| Fly.io | 無 |
| Railway | 無（$5 試用額度） |
| Render | 有，服務閒置會休眠 |
| Supabase | 有，project 7 天無活動會暫停 |
| Neon | 有 |
| Upstash Redis | 有，10k 指令 / 天 |
| EAS Build | 有，每月建置次數有限 |

## 額外判斷

- CI/CD：預設 GitHub Actions，寫在「注意事項」；Bun 專案用 `oven-sh/setup-bun` action；Rust 用 multi-stage Dockerfile（`rust:slim` build → `debian:slim` 或 `distroless` runtime）並開 cargo cache，否則 CI 時間很長。
- 選 Bun 且前端為 Next.js 部署在 Vercel：Vercel 可用 Bun 安裝套件，但 serverless functions 仍跑 Node；backend 若要 Bun runtime 必須拆到容器平台。
- Object storage：AWS → S3；GCP → GCS；其他 → Cloudflare R2（無 egress 費）。
- Cloudflare 資源全部宣告在 `wrangler.toml`（bindings），這就是 IaC，不另用 Terraform；D1 migrations 用 `wrangler d1 migrations` 或 Drizzle Kit。
- 監控：小專案 → 平台內建 + Sentry；中大型 → OpenTelemetry + Grafana 或 Datadog（非標準候選）。
- IaC：只有 AWS/GCP/K8s 才建議（Terraform 或 Pulumi）；PaaS 不需要。
- 選 Vercel 時若 backend 有長任務或 WebSocket，必須拆出去（Fly.io / Railway），在文件中明確標注。
