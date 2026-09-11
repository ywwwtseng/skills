# Backend 候選與判斷準則

## 候選清單（窄範圍）

| 技術 | 語言 | 定位 |
|---|---|---|
| Next.js Route Handlers / Server Actions | TypeScript | 前後端同倉，適合小型全端 |
| Hono | TypeScript | 極輕量，edge/serverless 友善，Node / Bun / Workers 皆可跑 |
| Elysia | TypeScript（Bun） | Bun 原生框架，端到端型別安全（Eden），效能最高 |
| NestJS | TypeScript | 企業級結構化框架，DI、模組化 |
| FastAPI | Python | 高效能 async API，AI/ML 生態 |
| Django | Python | 全功能，內建 admin/ORM/auth |
| Go（net/http + chi 或 Gin） | Go | 高併發、低資源、單一 binary 部署 |
| Axum | Rust | 高效能、記憶體安全、單一 binary；tokio 生態，適合高併發與重運算 |
| Spring Boot | Java/Kotlin | 企業級、大團隊（使用者以 Other 指定時） |

## 情境 → 推薦

| 情境 | 首選 | 替代 | 避免 |
|---|---|---|---|
| 小型全端 + Next.js 前端 | Next.js Route Handlers | Hono | NestJS（過重） |
| TypeScript + edge/serverless 部署 | Hono | Next.js | NestJS |
| TypeScript + Bun runtime | Hono（on Bun） | Elysia（願意綁定 Bun 生態時） | NestJS（Bun 相容性未完全） |
| TypeScript + 中大型團隊、需明確架構 | NestJS | Hono + 自訂結構 | — |
| Python + AI 推論 / ML 整合 | FastAPI | Django + DRF | — |
| Python + 大量 CRUD、需要 admin 後台 | Django | FastAPI + SQLAdmin | — |
| 高併發、real-time、資源受限 | Go | NestJS + ws | Django |
| Rust 團隊 | Axum | Actix-web（非標準候選） | — |
| Rust + 需要快速迭代 CRUD | 警告：Rust 開發速度較慢，若無效能或安全硬需求建議改 TS / Python | Axum | — |
| 高併發 + 重運算（如即時處理、加密、媒體轉檔） | Rust（Axum） | Go | Python |
| Java/Kotlin 團隊（Other） | Spring Boot | — | — |
| 重背景任務 / 排程 | 依語言：BullMQ（TS）/ Celery（Py）/ asynq（Go）/ apalis（Rust） | — | 自己寫 cron loop |

## TypeScript runtime：Node.js vs Bun

| 情境 | 推薦 | 說明 |
|---|---|---|
| 讓 skill 推薦 + 部署 Vercel / Cloudflare | Node.js | Vercel functions 與 Workers 不以 Bun 為 runtime |
| 讓 skill 推薦 + 容器部署（Fly.io / Railway / Cloud Run / K8s） | Node.js（預設） | 穩定優先；使用者未主動要求不推 Bun |
| 使用者選 Bun | Bun | 部署必須走容器（`oven/bun` image）；Next.js 可用 Bun 裝套件但 runtime 仍為 Node |
| 選 Bun + NestJS | 警告 | NestJS 在 Bun 上有相容性問題，建議改 Hono 或 Elysia |
| 選 Bun + 需要 Node-only 套件（如部分 native addon） | 標注風險 | 在「風險 / 注意事項」列出需驗證的套件 |

## 額外判斷

- Real-time：TS 用 Socket.IO 或原生 ws；Go 用 gorilla/websocket 或 nhooyr；Python 用 FastAPI WebSocket；Rust 用 axum 內建 ws（tokio-tungstenite）。
- 多語言團隊（如 TS + Rust）：backend 用非 TS 語言時，`packages/api-client` 由 OpenAPI spec 產生（utoipa for Rust、FastAPI 內建、swag for Go），不能用 tRPC。
- 檔案上傳：一律建議直傳 object storage（presigned URL），不經過 backend。
- 若使用者選了「混合語言」團隊：以 backend 主要維護者的語言為準，問一題確認。
- AI 整合（呼叫 LLM API）：任何語言皆可；若需 embedding pipeline 或 fine-tune，優先 Python。
