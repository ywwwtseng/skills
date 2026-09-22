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
| Spring Boot | Java/Kotlin | 企業級（使用者以 Other 指定時） |

## 情境 → 推薦

| 情境 | 首選 | 替代 | 避免 |
|---|---|---|---|
| 小型全端 + Next.js 前端 | Next.js Route Handlers | Hono | NestJS（過重） |
| TypeScript + edge/serverless 部署 | Hono | Next.js | NestJS |
| TypeScript + Bun runtime | Hono（on Bun） | Elysia（願意綁定 Bun 生態時） | NestJS（Bun 相容性未完全） |
| TypeScript + 中型以上規模、需明確架構 | NestJS | Hono + 自訂結構 | — |
| Python + AI 推論 / ML 整合 | FastAPI | Django + DRF | — |
| Python + 大量 CRUD、需要 admin 後台 | Django | FastAPI + SQLAdmin | — |
| 高併發、real-time、資源受限 | Go | NestJS + ws | Django |
| 高併發 + 重運算（如即時處理、加密、媒體轉檔） | Go | Python（重運算交給原生擴充） | — |
| 指定 Java/Kotlin（Other） | Spring Boot | — | — |
| 重背景任務 / 排程 | 依語言：BullMQ（TS）/ Celery（Py）/ asynq（Go） | — | 自己寫 cron loop |

## TypeScript runtime：Node.js / Bun / Cloudflare Workers

| 情境 | 推薦 | 說明 |
|---|---|---|
| 部署 Cloudflare | Cloudflare Workers（workerd） | 不問 runtime 題；框架用 Hono，DB 走 D1 或 Hyperdrive / Neon HTTP driver，長連線用 Durable Objects；限制見下方 |
| 讓 skill 推薦 + 部署 Vercel | Node.js | Vercel functions 不以 Bun 為 runtime |
| 讓 skill 推薦 + 容器部署（Fly.io / Railway / Cloud Run / K8s） | Node.js（預設） | 穩定優先；使用者未主動要求不推 Bun |
| 使用者選 Bun | Bun | 部署必須走容器（`oven/bun` image）；Next.js 可用 Bun 裝套件但 runtime 仍為 Node |
| 選 Bun + NestJS | 警告 | NestJS 在 Bun 上有相容性問題，建議改 Hono 或 Elysia |
| 選 Bun + 需要 Node-only 套件（如部分 native addon） | 標注風險 | 在「風險 / 注意事項」列出需驗證的套件 |

### 免 build 執行

三種 runtime 都能直接跑 `.ts`，不需要 `tsc` 產出 `dist/`；型別檢查獨立用 `tsc --noEmit` 跑，寫進「約束與慣例」作為 agent 的驗證指令：

| Runtime | 執行方式 | 限制 |
|---|---|---|
| Node.js 23.6+ | `node app.ts`（內建 type stripping；22.x 需 `--experimental-strip-types`） | 不能用 `enum`、`namespace`、decorator、constructor 參數屬性等會產生 runtime code 的語法；NestJS 因依賴 decorator 不適用 |
| Bun | `bun run app.ts` | 無語法限制 |
| Cloudflare Workers | `wrangler dev` / `wrangler deploy`（內部以 esbuild 打包，不需自己設 build） | 無 Node `fs` / 長時間 CPU（免費層 10 ms、付費 30 s CPU time）；Node 相容 API 需開 `nodejs_compat` flag；不能開 TCP 直連傳統 DB，須經 Hyperdrive 或 HTTP driver |

預設：無雲偏好 → Node 23+ 直接跑；指定 Cloudflare → Workers；使用者選 Bun → Bun。文件「Infra」段的 CI 只需 `tsc --noEmit` + test，沒有 build job。

## 額外判斷

- Real-time：TS 用 Socket.IO 或原生 ws；Go 用 gorilla/websocket 或 nhooyr；Python 用 FastAPI WebSocket。
- 多語言（如 TS + Go）：backend 用非 TS 語言時，`packages/api-client` 由 OpenAPI spec 產生（FastAPI 內建、swag for Go），不能用 tRPC。
- 檔案上傳：一律建議直傳 object storage（presigned URL），不經過 backend。
- 勾選 ≥ 2 個非 TS 語言：問一題確認 backend 用哪個，不自行猜測。
- 無語言限制時的預設：與 frontend 同為 TS（Hono / Next.js Route Handlers），單一語言讓型別與 schema 可跨層共用；只有 AI/ML、高併發、重運算等需求才切換語言。
- AI 整合（呼叫 LLM API）：任何語言皆可；若需 embedding pipeline 或 fine-tune，優先 Python。
