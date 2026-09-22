# Frontend 候選與判斷準則

## 候選清單（窄範圍）

| 技術 | 定位 |
|---|---|
| Next.js | React 全端框架，SSR/SSG/RSC，生態最大 |
| Vite + React | 純 SPA，輕量、建置快、不綁部署平台 |
| Nuxt | Vue 全端框架，等同 Next.js 的 Vue 版 |
| SvelteKit | 輕量、runtime 小，適合效能敏感場景 |
| Astro | 內容導向網站，預設零 JS，可嵌入任何框架元件 |
| 無前端 / 純 API | 行動 App 後端或純服務 |

## 情境 → 推薦

| 情境 | 首選 | 替代 | 避免 |
|---|---|---|---|
| 需要 SEO（無框架偏好） | Next.js | Remix（非標準候選） | Vite SPA |
| 需要 SEO + 指定 Vue | Nuxt | Astro + Vue | — |
| 高互動後台 / dashboard，不需 SEO | Vite + React | Vite + Vue | Next.js（多餘的 SSR 複雜度） |
| 內容網站、部落格、文件站 | Astro | Next.js SSG | 純 SPA |
| 效能敏感、bundle 要小 | SvelteKit | Astro | — |
| 個人・小型、快速上線 | Next.js（Vercel 一鍵部署） | Vite + React | — |
| 行動 App 後端、無 Web UI | 無前端 | — | — |

## 額外判斷

- 語言限制為純 Python / Go 但需要 UI：仍推薦 TypeScript 框架（不計學習成本）；若 UI 極簡可提 HTMX + 後端模板（非標準候選）。
- 無框架偏好時預設 React 系（Next.js / Vite + React）：生態與範例最多，AI agent 友善度最高；Vue / Svelte 只在使用者指定或有明確效能需求時推薦。
- 大量表單 / CRUD 後台：推薦搭配 UI library（shadcn/ui 或 MUI），寫在「注意事項」。
- 需要 real-time UI：任一框架皆可，關鍵在 backend 是否支援 WebSocket。
