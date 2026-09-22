# Scaffold 指令對照表

原則：**用官方 CLI 建，不要手寫設定檔**；所有指令加 non-interactive 旗標；scaffold 完成後才依「約束與慣例」調整。
指令旗標會隨版本變動，跑之前若不確定先 `--help`；旗標不存在就退回互動最少的形式並在報告中說明。

## Monorepo 骨架

| 工具 | 指令 |
|---|---|
| Turborepo + pnpm | `pnpm dlx create-turbo@latest . --package-manager pnpm --skip-install` |
| Turborepo + bun | `bunx create-turbo@latest . --package-manager bun --skip-install` |
| pnpm workspace（手動） | 建 `pnpm-workspace.yaml`：`packages: ["apps/*", "packages/*"]` |
| uv workspace（Python） | `uv init --name <name>`，父 `pyproject.toml` 加 `[tool.uv.workspace] members = ["apps/*"]` |
| Go workspace | `go work init ./apps/api` |

Monorepo 內建立 app 時，先 `cd apps/` 再跑各框架 CLI；建完回根目錄安裝一次。

## Frontend

| 技術 | 指令 |
|---|---|
| Next.js | `pnpm create next-app@latest <dir> --ts --app --eslint --tailwind --src-dir --import-alias "@/*" --use-pnpm --no-turbopack --skip-install` |
| Vite + React | `pnpm create vite@latest <dir> --template react-ts` |
| Vite + Vue | `pnpm create vite@latest <dir> --template vue-ts` |
| Nuxt | `pnpm dlx nuxi@latest init <dir> --packageManager pnpm --no-install --gitInit false` |
| SvelteKit | `pnpm dlx sv create <dir> --template minimal --types ts --no-install` |
| Astro | `pnpm create astro@latest <dir> -- --template minimal --typescript strict --no-install --no-git` |

後續：UI library（決策文件有寫才裝）`pnpm dlx shadcn@latest init -d`。

## Mobile

| 技術 | 指令 |
|---|---|
| Expo | `pnpm create expo-app@latest <dir> --template blank-typescript --no-install` |
| Expo（monorepo） | 建完加 `metro.config.js` 的 workspace 設定（`watchFolders` 指到 repo root、`nodeModulesPaths`） |
| Flutter | `flutter create --org <reverse.domain> <dir>` |
| Capacitor | 在既有 web app 內：`pnpm add @capacitor/core && pnpm add -D @capacitor/cli && pnpm exec cap init <name> <appId> --web-dir dist` |

EAS 設定（`eas.json`）只建檔，不執行 `eas build`、不登入帳號。

## Backend

| 技術 | 指令 |
|---|---|
| Hono | `pnpm create hono@latest <dir> --template <nodejs\|bun\|cloudflare-workers> --pm pnpm --install false` |
| Elysia（Bun） | `bun create elysia <dir>` |
| NestJS | `pnpm dlx @nestjs/cli new <dir> --package-manager pnpm --skip-install --skip-git --language TS` |
| Next.js Route Handlers | 不另建 app，於既有 Next.js 的 `src/app/api/` 下開檔 |
| FastAPI | `uv init <dir> && uv add fastapi "uvicorn[standard]" pydantic-settings`，手建 `app/main.py` |
| Django | `uv init <dir> && uv add django && uv run django-admin startproject config .` |
| Go | `go mod init <module-path>`，手建 `cmd/api/main.go` + `internal/`；chi：`go get github.com/go-chi/chi/v5` |

## Database / ORM

| 技術 | 指令 |
|---|---|
| Prisma | `pnpm add -D prisma && pnpm add @prisma/client && pnpm exec prisma init --datasource-provider postgresql` |
| Drizzle | `pnpm add drizzle-orm pg && pnpm add -D drizzle-kit @types/pg`，手建 `drizzle.config.ts` + `src/db/schema.ts` |
| Cloudflare D1 | `pnpm exec wrangler d1 create <name>`（會建雲端資源 → 先問使用者；否則只寫 `wrangler.toml` 範本） |
| SQLAlchemy + Alembic | `uv add sqlalchemy alembic psycopg[binary] && uv run alembic init migrations` |
| Django ORM | 內建，`uv run python manage.py startapp <app>` |
| Go（sqlc + pgx） | `go get github.com/jackc/pgx/v5`，手建 `sqlc.yaml` + `db/query/` |
| MongoDB | TS：`pnpm add mongoose`；Python：`uv add beanie motor` |

本機服務一律用 `docker-compose.yml`（`postgres:17-alpine`、`redis:7-alpine`），不自動 `docker compose up`。

## 工具鏈

| 用途 | TypeScript | Python | Go |
|---|---|---|---|
| lint + format | `pnpm add -D --save-exact @biomejs/biome && pnpm exec biome init`（框架已帶 ESLint 就沿用，不並存兩套） | `uv add --dev ruff` | `golangci-lint`（建 `.golangci.yml`） |
| 測試 | `pnpm add -D vitest`（Next.js E2E 另裝 Playwright，決策文件有寫才裝） | `uv add --dev pytest` | 內建 `go test` |
| 型別檢查 | `tsc --noEmit`（scaffold 已含 tsconfig，補 `"strict": true`） | `uv add --dev mypy` | `go vet` |
| 環境變數驗證 | `pnpm add zod` + `src/env.ts` | `pydantic-settings` | `env` struct + 啟動時檢查 |

`package.json` scripts 一律補齊：`dev`、`build`、`typecheck`、`lint`、`test`。Monorepo 在 `turbo.json` 定義同名 pipeline，根 `package.json` 用 `turbo run <task>` 轉發。

## CI

`.github/workflows/ci.yml` 最小版：checkout → setup（pnpm / uv / go）→ install（lockfile 模式）→ `typecheck` → `lint` → `test` → `build`。Monorepo 改用 `turbo run typecheck lint test build --filter=...[origin/main]`。

## 不要做的事

- 不跑 `git commit` / `git push`（交給 `/git:commit`）
- 不跑會建立雲端資源或需要登入的指令（`vercel deploy`、`eas build`、`wrangler deploy`、`gcloud` / `aws` create）——只產設定檔，並寫進最終報告的「下一步」
- 不寫真實 secrets，只寫 `.env.example`
- 不裝決策文件沒提到的套件
