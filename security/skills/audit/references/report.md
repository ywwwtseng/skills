# 報告格式

在對話中輸出。總計放最上面，使用者第一眼就知道嚴不嚴重；掃描涵蓋表緊接在後，讓人知道這份結論的邊界在哪。順序：總計 → 掃描涵蓋 → 與上次比較（有上一份才有）→ 威脅模型 → Findings → 待確認 → 已排除 → 其他觀察 → 建議細看的路徑 → 建議處理順序。

## 模板

````markdown
# Security Audit Report

> 專案：<repo 名>　|　commit：<短 hash>（工作區有未 commit 的變更時註明）　|　日期：<YYYY-MM-DD>　|　範圍：standard，整個 repo

```
CRITICAL  <n>
HIGH      <n>
MEDIUM    <n>
LOW       <n>
```

## 掃描涵蓋

| 步驟 | 工具 | 狀態 | 範圍 / 原因 |
|---|---|---|---|
| Secrets | Gitleaks 8.x | ran | git 歷史 <N> 個 commit + 工作目錄 |
| Dependencies | pnpm audit | ran | `pnpm-lock.yaml`，<N> 個套件 |
| Source Code | Semgrep 1.x | ran | p/default、p/owasp-top-ten、p/typescript；<N> 個檔案解析失敗 |
| IaC | Trivy config | ran | `terraform/`（tf-vars：`prod.tfvars`） |
| Docker | Trivy image | skipped | 有 Dockerfile，本機沒有 image，使用者選擇不 build |
| Review | Claude | ran | 確認 <N> 條 HIGH 以上、排除 <N> 條誤報；入口 <N> 個，深讀 <M> 個（未深讀的不算檢查過）；信任邊界 <N> 條，沒覆蓋到：<哪幾條，或「無」> |
| 反證 | 獨立 subagent | ran | <N> 條 HIGH 以上交給沒參與的 subagent 推翻：維持 <a>、降級 <b>、推翻 <c>、改列待確認 <d> |

狀態只有四種：`ran` / `skipped`（有對象但沒跑，寫原因）/ `n/a`（沒有對象）/ `error`（跑了但失敗，附錯誤訊息）。範圍不是 standard 整個 repo 時（quick、指定路徑、`--diff`），這一節第一行寫「**這是部分檢查**：<沒涵蓋的是什麼>」。

## 與上次比較

> 上一份：`docs/security/audit-2026-10-13.md`（commit a1b2c3d）

| 上次的 finding | 上次的處理 | 這次 |
|---|---|---|
| [HIGH] 訂單查詢用 query string 的 shopId | 已修復（`b7e0c52`） | 已確認修好：`route.ts:6` 改用 `merchant.shopId` |
| [HIGH] 未登入可無限呼叫 LLM | 之後再說 | 仍存在，列在下面 Findings |
| [MEDIUM] xxx 套件漏洞 | 已修復 | **又出現**：lockfile 被降回 4.17.20，列在下面 Findings |

新增 <n> 條、仍存在 <n> 條、已修好 <n> 條。

## 威脅模型

**系統**：<一兩句：它是什麼、怎麼跑（網路服務 / CLI / 桌面 App / 函式庫）、主要元件，各附 `檔案:行號`>

**信任邊界**
- 網際網路 → API server：JSON body、session cookie｜HTTPS｜session 驗證（`middleware.ts:12`）；`/api/export` 不在 matcher 裡
- 瀏覽器 → Supabase：前端直接查 `orders`｜anon key｜RLS（`migrations/003.sql:20`）
- 外部 PR → CI：PR 的程式碼｜GitHub Actions｜`pull_request`（沒有 secret）

**資產**：訂單與付款狀態（I）、會員個資（C）、Stripe secret key（C）、LLM 額度（A，會花錢）

**攻擊者**：能做——匿名者打所有公開 route、已登入的一般會員改自己的 request、能開 PR 的外部貢獻者；不能做——改伺服器設定、拿到其他租戶的帳號

**這個 repo 的嚴重度**：CRITICAL＝未登入讀到所有訂單；HIGH＝會員改別人的訂單；MEDIUM＝要先有管理員帳號的 SSRF；LOW＝版本號外洩

**假設**（沒有確認，結論依它成立）：<例如「只有一個租戶」「前面沒有 WAF」；使用者在 Step 0 回答過的寫「已確認」>

## Findings

### [CRITICAL] AWS access key 在 git 歷史中
File: config/aws.ts:12（commit a1b2c3d4，2026-03-02，已在之後的 commit 刪除）
Source: Gitleaks `aws-access-token`
Fix: 先到 AWS IAM 撤銷並換發這把 key，再檢查 CloudTrail 有沒有異常使用；改寫歷史救不回已外流的 key。

### [HIGH] SQL Injection
File: app/api/orders/route.ts:42
Source: Semgrep `javascript.lang.security.audit.sqli.node-postgres-sqli` + Claude review（信心：高；已確認：`searchParams.get("sort")` 未經白名單直接拼進 `ORDER BY`）
CWE: CWE-89
根因: 「進到 SQL 的識別字（欄位名）必須來自固定清單」這條被破壞——`buildOrderQuery()` 直接把 query string 拼進字串
證據: `route.ts:18` 讀 `sort` → `route.ts:31` 傳給 `buildOrderQuery(sort)` → `db/orders.ts:42` 拼進 `ORDER BY ${sort}`，中間沒有白名單
對照: `app/api/products/route.ts:25` 同樣的排序參數有用 `SORTABLE_COLUMNS` 白名單
反證: 有找 middleware 與 zod schema，`/api/orders` 的 query 沒有經過任何 schema 驗證
升降條件: 若這個 route 只開放給管理員且有登入檢查 → 降為 MEDIUM
Fix: 排序欄位改用白名單對照；值一律走參數化查詢。回歸測試：`GET /api/orders?sort=id;DROP TABLE orders` 應回 400，且實際執行的 SQL 不含該字串。

### [HIGH] Terraform allows 0.0.0.0/0
File: terraform/modules/alb/main.tf:18
Source: Trivy config `AVD-AWS-0107`
Fix: ingress 的 `cidr_blocks` 收窄到 CloudFront 的 prefix list；只開 443。

### [MEDIUM] npm package vulnerability
Package: xxx 4.17.20（直接依賴）→ 修補版本 4.17.21（patch）
Source: pnpm audit，GHSA-xxxx-xxxx-xxxx
Fix: `pnpm update xxx`，patch 升級，應無破壞性變更。

### [LOW] …

## 待確認

程式碼路徑成立，但決定成不成立的事實不在 repo 裡。**沒有嚴重度、不是確認的漏洞**；`/security:fix` 不處理這一節，確認完再跑一次 `/security:audit`。

| 標題 | 程式碼路徑 | 缺的事實 | 怎麼確認 |
|---|---|---|---|
| `/internal/*` 可能從外部打得到 | `server.ts:40` 掛了 `/internal` 而且沒有認證 → `internal/flush.ts:12` 清空 cache | nginx / ALB 有沒有擋 `/internal/*`（repo 裡沒有 proxy 設定） | 看 production 的 ingress 設定；或請維運從外部 `curl -I` 一次自己的站 |

## 已排除

| 來源 | 規則 | 位置 | 理由 |
|---|---|---|---|
| Gitleaks | generic-api-key | `tests/fixtures/stripe.json:4` | 測試 fixture，值是 Stripe 文件裡的公開範例 key |
| Semgrep | sqli | `src/db/users.ts:30` | 已使用 `$1` 參數化，規則無法辨識 Drizzle 的 `sql` 模板 |

## 其他觀察

<依 `review.md`「預設不報」沒有列成 finding 的事項，一項一行；沒有就寫「無」>
- 全站沒有設定 CSP（目前沒找到可串上的 XSS）
- `scripts/seed.ts` 用字串拼 SQL，但只在本機 seed 時執行、沒有被 CI 或部署流程引用

## 建議細看的路徑

沒深讀到、但威脅模型顯示風險高的地方，下一輪或人工 review 先看這裡（最多 10 個）：

| 路徑 | 為什麼 |
|---|---|
| `app/api/admin/` | 管理後台的 8 個 route 只深讀了 2 個，授權寫在各 handler 裡沒有共用 |
| `.github/workflows/release.yml` | 拿得到 npm 發佈 token，用了沒釘 SHA 的第三方 action |

## 建議處理順序

1. <最先處理的，通常是歷史裡的 secret：撤銷憑證>
2. <可被外部直接利用的 HIGH>
3. <patch 等級就能修的套件漏洞，一次處理>
4. <需要改架構或 major 升級的，排進 backlog>
````

## 寫法

- **每條 finding 都有 File（或 Package）、Source、Fix 三行。** 沒有位置的 finding 無法處理；沒有修法的 finding 只是在製造焦慮。
- **Source 寫工具與規則 ID。** 兩個工具都報的合併成一條，Source 寫兩個。Claude review 找到的寫 `Claude review（信心：高 / 中）`。
- **HIGH 以上的 Source 要附一句確認結果**（讀了哪裡、為什麼成立），這是 SKILL 核心規則 7 的證據。
- **程式碼類的 HIGH 以上（Semgrep 或 Claude review 找到、確認成立的）另外加這幾行**；套件漏洞與 secret 不用：
  - `CWE`：可查表的編號，不只寫自由文字分類。
  - `根因`：被破壞的是哪一條規則（「識別字必須來自固定清單」「查詢必須帶擁有者條件」），以及哪段程式碼破壞它。只重寫一次 `檔案:行號` 不算根因。位置寫真正出問題的那一層；外層 route 與底層 helper 都有責任時兩個都列。
  - `證據`：輸入從哪進來 → 經過哪裡 → 缺了哪道檢查 → 到哪個危險操作，每段一個 `檔案:行號`。
  - `對照`（有就寫）：同一個專案裡別處**有做**這道檢查的位置。「那裡有、這裡沒有」是最有說服力的證據。
  - `反證`：找過、可能讓這條不成立的東西，以及為什麼它沒擋住。一條都寫不出來，代表沒找過，不是沒有。
  - `證據缺口`（信心 `中` 時必寫）：還缺哪個事實才能確定，例如「沒讀到 `lib/auth.ts` 的 `requireOwner` 實作」。缺口不能拿來當成「應該沒事」。
  - `升降條件`：一句話講補到什麼證據會讓嚴重度升或降。寫不出來，代表這個嚴重度是猜的。
  - `Fix` 後面接一條**回歸測試**的具體寫法：輸入什麼、預期什麼，修補拿掉後這條測試要失敗。寫成可以直接交給 `/impl:fix` 的樣子。
- **同一個套件的多個 CVE 合併成一條**，寫最高嚴重度、列出 CVE / GHSA 編號、給一個升級目標版本。
- **同一條 Semgrep 規則命中 20 個地方**，合併成一條，列前 5 個位置並寫「另 15 處，同一模式」。
- **不寫 secret 的值**，連部分字元都不寫（SKILL 核心規則 3）。
- 總計數字是**排除誤報之後**的數字，並且與下面的 findings 條數一致（合併後的條數，不是原始命中數）。
- **待確認不算進總計**，也不寫嚴重度。每列都要有「缺的事實」與「怎麼確認」；確認方法不能是去打正式環境做攻擊測試。
- **與上次比較**：讀過上一份報告才寫（SKILL Step 0）。上次標 `已修復` 的要讀程式碼確認真的修好，不照抄處理紀錄；又出現的明講「又出現」。
- **威脅模型**每個元件與控制都要有 `檔案:行號`；沒確認的假設寫在「假設」，不要混在事實裡。
- 全部都是 0 時，仍然輸出掃描涵蓋表。有任何一步是 `skipped` 或 `error`，總結要寫「以下步驟未執行，結論不涵蓋它們」，不能寫「未發現問題」。
