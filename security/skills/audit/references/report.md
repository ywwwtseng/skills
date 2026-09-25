# 報告格式

在對話中輸出。總計放最上面，使用者第一眼就知道嚴不嚴重；掃描涵蓋表緊接在後，讓人知道這份結論的邊界在哪。

## 模板

````markdown
# Security Audit Report

> 專案：<repo 名>　|　commit：<短 hash>　|　日期：<YYYY-MM-DD>

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
| Review | Claude | ran | 確認 <N> 條 HIGH 以上、排除 <N> 條誤報；入口 <N> 個，深讀 <M> 個（未深讀的不算檢查過） |

狀態只有四種：`ran` / `skipped`（有對象但沒跑，寫原因）/ `n/a`（沒有對象）/ `error`（跑了但失敗，附錯誤訊息）。

## Findings

### [CRITICAL] AWS access key 在 git 歷史中
File: config/aws.ts:12（commit a1b2c3d4，2026-03-02，已在之後的 commit 刪除）
Source: Gitleaks `aws-access-token`
Fix: 先到 AWS IAM 撤銷並換發這把 key，再檢查 CloudTrail 有沒有異常使用；改寫歷史救不回已外流的 key。

### [HIGH] SQL Injection
File: app/api/orders/route.ts:42
Source: Semgrep `javascript.lang.security.audit.sqli.node-postgres-sqli` + Claude review（已確認：`searchParams.get("sort")` 未經白名單直接拼進 `ORDER BY`）
Fix: 排序欄位改用白名單對照；值一律走參數化查詢。

### [HIGH] Terraform allows 0.0.0.0/0
File: terraform/modules/alb/main.tf:18
Source: Trivy config `AVD-AWS-0107`
Fix: ingress 的 `cidr_blocks` 收窄到 CloudFront 的 prefix list；只開 443。

### [MEDIUM] npm package vulnerability
Package: xxx 4.17.20（直接依賴）→ 修補版本 4.17.21（patch）
Source: pnpm audit，GHSA-xxxx-xxxx-xxxx
Fix: `pnpm update xxx`，patch 升級，應無破壞性變更。

### [LOW] …

## 已排除

| 來源 | 規則 | 位置 | 理由 |
|---|---|---|---|
| Gitleaks | generic-api-key | `tests/fixtures/stripe.json:4` | 測試 fixture，值是 Stripe 文件裡的公開範例 key |
| Semgrep | sqli | `src/db/users.ts:30` | 已使用 `$1` 參數化，規則無法辨識 Drizzle 的 `sql` 模板 |

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
- **同一個套件的多個 CVE 合併成一條**，寫最高嚴重度、列出 CVE / GHSA 編號、給一個升級目標版本。
- **同一條 Semgrep 規則命中 20 個地方**，合併成一條，列前 5 個位置並寫「另 15 處，同一模式」。
- **不寫 secret 的值**，連部分字元都不寫（SKILL 核心規則 3）。
- 總計數字是**排除誤報之後**的數字，並且與下面的 findings 條數一致（合併後的條數，不是原始命中數）。
- 全部都是 0 時，仍然輸出掃描涵蓋表。有任何一步是 `skipped` 或 `error`，總結要寫「以下步驟未執行，結論不涵蓋它們」，不能寫「未發現問題」。
