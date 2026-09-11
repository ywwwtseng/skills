# Infra 候選與判斷準則

## 候選清單（窄範圍）

| 技術 | 定位 |
|---|---|
| Vercel | Next.js 原生平台，零設定 |
| Cloudflare（Pages / Workers） | Edge 優先，免費層慷慨，適合 Hono / Astro |
| Fly.io | 容器即服務，接近 VPS 的彈性但免運維；**無免費層**，最小配置約 $5 / 月 |
| Railway / Render | 簡單 PaaS，git push 部署，含 DB；Railway Hobby $5 / 月，Render 有免費層但會休眠 |
| AWS（ECS / Lambda + RDS） | 企業級、完整生態、需要運維知識 |
| GCP（Cloud Run + Cloud SQL） | 容器 serverless 體驗最好 |
| VPS + Docker Compose（Hetzner / DO） | 最低成本、完全掌控、需自己運維 |
| Kubernetes | 只在多服務 + 有專職 infra 人力時 |

## 情境 → 推薦

| 情境 | 首選 | 替代 | 避免 |
|---|---|---|---|
| Next.js + 無雲偏好 | Vercel | Cloudflare | AWS（過重） |
| Backend runtime 選 Bun | Fly.io 或 Railway（Dockerfile `oven/bun`） | Cloud Run | Vercel functions / Cloudflare Workers（runtime 非 Bun） |
| Hono / Astro / edge 導向 | Cloudflare | Vercel | — |
| 需要長連線（WebSocket）、背景 worker | Fly.io | Railway | Vercel（serverless 限制） |
| Go / Rust / Python 容器化服務、小團隊 | Fly.io 或 Railway | Cloud Run | Kubernetes |
| 指定 AWS | ECS Fargate + RDS | Lambda（若純 API 且冷啟動可接受） | 自建 EC2 集群 |
| 指定 GCP | Cloud Run + Cloud SQL | GKE Autopilot | — |
| 預算極低、可接受自己運維 | VPS + Docker Compose（Hetzner 約 €4 / 月） | Fly.io | 任何 managed K8s |
| 預算極低、不想運維、純靜態或 edge 可跑 | Cloudflare Pages / Workers（免費層） | Vercel Hobby | — |
| 預算極低、需要容器（Bun / WebSocket / worker） | Fly.io（約 $5 / 月，標注非免費） | Render 免費層（會休眠，WebSocket 不穩） | — |
| 必須地端 / 自架 | VPS 或內部 VM + Docker Compose | K3s（若多服務） | 完整 Kubernetes |
| 企業級、多服務、有 infra 團隊 | Kubernetes（EKS / GKE） | ECS | — |

## 免費層現況（推薦時要寫進「預估月費」）

| 服務 | 免費層 |
|---|---|
| Cloudflare Pages / Workers | 有，靜態與 Workers 額度慷慨 |
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
- 監控：小專案 → 平台內建 + Sentry；中大型 → OpenTelemetry + Grafana 或 Datadog（非標準候選）。
- IaC：只有 AWS/GCP/K8s 才建議（Terraform 或 Pulumi）；PaaS 不需要。
- 選 Vercel 時若 backend 有長任務或 WebSocket，必須拆出去（Fly.io / Railway），在文件中明確標注。
