# 專案架構模式：Repo 結構與服務拓撲

## 問題與選項文案

### Q. 專案架構模式偏好？（單選，Step 2）

| 選項 | description |
|---|---|
| 讓 skill 推薦 | 依平台數、語言、團隊規模決定 |
| Monorepo | 前後端、App、共用套件同一 repo，統一工具鏈與版本 |
| 單一應用 | 一個全端框架一個 repo（如 Next.js 全包），最少設定 |
| Polyrepo | 前後端分開 repo，各自 CI/CD 與部署，團隊邊界清楚 |

## Repo 結構：情境 → 推薦

| 情境 | 首選 | 替代 | 避免 |
|---|---|---|---|
| 只做 Web + 個人・小型 + TS | 單一應用（Next.js 全包） | Monorepo | Polyrepo |
| Web + App + TS | Monorepo（Turborepo + pnpm workspace） | Nx | Polyrepo（型別無法共用） |
| 前後端不同語言（如 Next.js + FastAPI） | Monorepo（pnpm workspace + uv workspace，Turborepo 只管 TS 部分） | Polyrepo | — |
| 純 Go 後端 + 獨立前端 | Monorepo（Go workspace + pnpm workspace） | Polyrepo | — |
| Rust 後端 + TS 前端 | Monorepo（cargo workspace + pnpm workspace，Turborepo 只管 TS） | Polyrepo | — |
| 多團隊、各自 release 節奏 | Polyrepo | Monorepo + CODEOWNERS | — |
| 純 API 無 UI | 單一 repo | — | Monorepo（過度設計） |
| 大型・企業級治理 + 5 人以上 | Monorepo（Nx，需 affected graph） | Turborepo | Polyrepo 散落 |

## Monorepo 工具選擇

| 情境 | 工具 |
|---|---|
| TS 為主、以簡單為優先 | Turborepo + pnpm workspace（預設） |
| TS 為主、runtime 選 Bun | Turborepo + bun workspaces（`bun install` 取代 pnpm） |
| 需要 code generator、依賴圖分析、多語言 plugin | Nx |
| Python 為主 | uv workspace |
| Go 為主 | Go workspace（go.work） |
| Rust 為主 | cargo workspace（`[workspace]` in root Cargo.toml） |

## Monorepo 標準骨架（Turborepo）

```
.
├── apps/
│   ├── web/          # Next.js / Vite
│   ├── mobile/       # Expo（有 App 時）
│   └── api/          # Hono / NestJS / FastAPI / Axum（若與前端分開）
├── packages/
│   ├── types/        # 共用型別、zod schema
│   ├── api-client/   # 由 OpenAPI 或 tRPC 產生
│   ├── ui/           # 共用元件（web 與 mobile 通常不共用，可省略）
│   └── config/       # eslint / tsconfig / tailwind preset
├── turbo.json
└── pnpm-workspace.yaml   # Bun 時改為 package.json 的 "workspaces" 欄位
```

## 服務拓撲（不另提問，由規模與需求推得）

| 規模檔位 | 拓撲 | 說明 |
|---|---|---|
| 個人・小型 / 團隊・內部 | 單體 | 一個部署單元，最低維運 |
| 中型商業應用 | 模組化單體 | 單一部署，但程式碼依 domain 分模組；背景任務拆成 worker |
| 大型 + 高流量 | 模組化單體 + 獨立 worker / 讀寫分離 | 先水平擴展單體，不急著微服務 |
| 大型 + 企業級治理 或 超大規模 | 微服務或依 domain 拆分 | 需要有 infra 團隊；文件中標注前提 |

原則：**預設模組化單體**，只有多團隊各自部署或超大規模才推微服務，並在文件中寫明拆分的前提條件。

## 額外判斷

- 選 Monorepo 時，Infra 段落要提 CI 只建置 affected 專案（Turborepo remote cache 或 Nx affected）。
- Vercel 部署 monorepo 內的 Next.js：設 root directory 為 `apps/web`。
- Polyrepo 時要在文件中提 API 契約管理（OpenAPI spec 版本化或 published api-client 套件）。
