---
name: audit
description: 對目前專案依序跑一輪安全掃描再由 Claude 分析結果——Secrets（Gitleaks，含 git 歷史）→ Dependencies（npm / pnpm / yarn / bun audit，非 JS 專案用 Trivy fs）→ Source Code（Semgrep，關閉 metrics）→ IaC（Trivy config，含 Terraform / Kubernetes / Dockerfile）→ Docker（Trivy image）→ Review（讀程式碼排除誤報、合併重複、統一嚴重度、再依入口清單人工檢查掃描器看不到的存取控制、業務邏輯、SSRF、認證與資料外洩），最後輸出 CRITICAL / HIGH / MEDIUM / LOW 計數與逐條 finding（檔案:行號、套件、修法）。只由使用者以 /security:audit 手動執行，不會被自動觸發。本 skill 只掃描與回報，不修程式、不升級套件、不改設定、不 commit。
disable-model-invocation: true
---

# Security Audit

一次跑完五類掃描器，再由 Claude 把原始結果變成一份**可以照著處理**的報告。

掃描器各自只看得到一塊：Gitleaks 不懂套件、npm audit 不看程式碼、Semgrep 不看 Terraform。它們的原始輸出又多又吵——同一個問題報三次、測試用的假 key 也算、嚴重度標準各不相同。**第 6 步的 Review 才是本 skill 的價值**：原始輸出不是報告。

## 定位

- **輸入**：目前的 repo（工作目錄 + git 歷史）、lockfile、IaC 檔、Dockerfile 與本機已建好的 image。
- **輸出**：對話中的 Security Audit Report（格式見 `references/report.md`）。原始 JSON 放在 repo 外的暫存目錄。
- **不做**：修程式碼、`npm audit fix` / 升級套件、改 Terraform、刪 secrets、改寫 git 歷史、`git commit`。修補交給使用者或 `/impl:fix`。

## 核心規則

1. **只讀不改。** 不跑任何會改檔案的指令：`npm audit fix`、`semgrep --autofix`、`trivy ... --fix` 都禁止。發現問題就回報，修法寫在報告裡。
2. **掃描結果放在 repo 外。** 原始報告寫到 `mktemp -d` 建的暫存目錄（有 scratchpad 就用 scratchpad），**絕不寫進 repo**——Gitleaks 的報告本身就含 secrets，放進 repo 會被下一次 `/git:commit` 帶走。
3. **不把 secret 印出來。** Gitleaks 一律加 `--redact`。報告只寫「哪個檔案、哪一行、哪一類 key、在哪個 commit」，不寫 key 的值，連前幾碼都不寫。
4. **不把程式碼送出去。** Semgrep 一律 `--metrics=off`，不用 `--config auto`（它要求開 metrics）、不登入 Semgrep Cloud。規則包會下載，但程式碼不會上傳。
5. **沒跑到不等於沒問題。** 工具沒裝、沒有對應的檔案、指令失敗，一律在報告的「掃描涵蓋」表標 `skipped` / `n/a` / `error` 並寫原因。**絕不因為某一步沒跑就在總結寫「未發現問題」。**
6. **非零 exit code 不等於工具壞了。** Gitleaks、npm audit、Trivy 有發現時都會回非零。判斷依據是 JSON 報告有沒有產出、能不能解析，不是 exit code。
7. **每個 HIGH / CRITICAL 都要打開原始碼確認。** 讀 finding 指到的那幾行和前後文，判斷是真的、誤報、還是只在測試 / 範例裡。沒讀過程式碼的 HIGH 不准寫進報告（核心規則 8 的例外除外）。
8. **套件漏洞以「是否被用到」調整，不以「是否存在」刪除。** dev-only、不可達的漏洞可以降級並註明理由，但不能從報告消失。
9. **不自己裝工具。** 缺工具時用 `AskUserQuestion` **一次問完**：列出缺哪些、安裝指令（`references/tools.md`）、選項是「我裝好了，繼續」/「跳過這幾項」。無人看守（例如包在 `/loop` 裡跑）時不問，直接標 `skipped`。
10. **不自動 build image。** `docker build` 會執行 Dockerfile 裡的任意指令。本機已經有這個專案的 image 才掃；沒有就問要不要 build，無人看守時標 `skipped`。

## 流程

### Step 0：盤點

1. 建暫存目錄：`OUT=$(mktemp -d -t security-audit)`，之後所有報告都寫進 `$OUT`（核心規則 2）。
2. 檢查工具：`command -v gitleaks semgrep trivy docker`，並抓版本（`gitleaks version`、`semgrep --version`、`trivy --version`）——指令語法依版本不同，見 `references/tools.md`。
3. 盤點專案形狀，決定每一步適不適用：
   - lockfile：`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` / `bun.lock(b)`；非 JS 的 `requirements*.txt` / `poetry.lock` / `uv.lock` / `go.sum` / `Cargo.lock`
   - IaC：`*.tf`、`*.tfvars`、`k8s/` / `*.yaml` 內含 `apiVersion:`、`Chart.yaml`、CloudFormation template
   - Docker：`Dockerfile*`、`docker-compose*.yml`；本機 image 用 `docker images` 找與專案名、compose service 名相符的
4. 缺工具 → 照核心規則 9 一次問完。

### Step 1：Secrets — Gitleaks

掃**兩個範圍**：git 全部歷史（刪掉的 key 在歷史裡還在，而且已經外流），以及工作目錄裡還沒 commit 的檔案。指令見 `references/tools.md`。

一定要 `--redact`（核心規則 3）。

### Step 2：Dependencies — npm audit

依 lockfile 選套件管理器（`references/tools.md`），在 lockfile 所在目錄跑。Monorepo 在根目錄跑一次就好（workspace 共用 lockfile）。

非 JS 的 lockfile 用 `trivy fs --scanners vuln` 補掃。兩者都沒有 → `n/a`。

### Step 3：Source Code — Semgrep

`--metrics=off`，規則包用 `p/default` + `p/owasp-top-ten`；有明確框架時加對應的包（`references/tools.md`）。排除 `node_modules`、`dist`、`.next`、`vendor` 等目錄。

### Step 4：IaC — Trivy config

`trivy config` 會掃 Terraform、Kubernetes、Helm、CloudFormation 與 Dockerfile 的設定錯誤。有 `*.tfvars` 時用 `--tf-vars` 帶進去，否則變數預設值會讓結果失真。沒有任何 IaC 檔 → `n/a`。

### Step 5：Docker — Trivy image

只掃本機已存在的 image（核心規則 10），`--scanners vuln,secret`。沒有 Dockerfile → `n/a`；有 Dockerfile 但沒有 image → 問或 `skipped`。

### Step 6：Review — Claude 分析

原始輸出可能上千行。**用 `jq`（沒有就用 `python3`）先摘要成「規則 / 檔案 / 行號 / 嚴重度」清單再讀**，不要把整份 JSON 倒進 context。

依序做：

1. **統一嚴重度**：照 `references/tools.md` 的對照表把各工具的等級換成 CRITICAL / HIGH / MEDIUM / LOW。
2. **合併重複**：同一個檔案同一行被兩個工具報，合成一條，來源寫兩個。同一個套件漏洞被 npm audit 和 Trivy image 都報，合成一條。
3. **逐條確認 HIGH / CRITICAL**（核心規則 7）：打開檔案讀前後文。判定：
   - `確認` → 保留
   - `誤報`（測試 fixture、文件裡的範例 key、已被參數化的查詢）→ 移到報告末尾「已排除」段，寫一句理由
   - `只在測試 / 開發環境` → 降一級並註明
4. **套件漏洞看可達性**（核心規則 8）：是直接還是間接依賴、是不是 devDependency、有沒有修補版本、升級是 patch 還是 major。
5. **補掃描器看不到的**：照 `references/review.md` 做人工檢查。先列出**全部**對外入口（依框架找 route、server action、controller），再依風險深讀：金額 → 認證 → 帶資源 ID 的寫入 → 檔案 → 對外請求 → 管理後台。對每個深讀的入口走九類清單：存取控制（IDOR、mass assignment、RLS）、認證與 session、注入、請求偽造與重導（SSRF、open redirect、CSRF、CORS、webhook 驗簽）、檔案上傳、業務邏輯（前端算的金額、負數、狀態跳步、race condition）、資料外洩、密碼學與隨機、設定。另外確認 `.env*` 有被 `.gitignore` 擋住。

   有 `docs/domain/business-rules/` 時，權限與約束類規則就是正確答案，逐條對照 handler 有沒有真的擋。

   找到的標來源 `Claude review` 與信心（`高`：從入口讀到 sink 且確認中間沒有檢查；`中`：檢查可能在沒讀到的地方）。只讀入口到資料存取這條路徑，不通讀整個 repo；報告寫明入口總數與深讀了幾個。
6. **每條 finding 寫修法**：一句話、可執行（升到哪一版、改成參數化查詢、CIDR 收窄到什麼）。

### Step 7：輸出報告

照 `references/report.md` 的格式在對話中輸出。順序：總計 → 掃描涵蓋 → findings（CRITICAL 到 LOW）→ 已排除 → 建議的處理順序。

**歷史裡找到的 secret 一律列在最前面**，修法固定是「先到服務商撤銷並換發，再考慮改寫歷史」——刪檔案或改寫歷史都救不回已經外流的 key。

使用者要求存檔時，才寫成 `docs/security/audit-<YYYY-MM-DD>.md`，並提醒：這份檔案列出了尚未修補的弱點，公開 repo 不該 commit 它。

最後刪掉 `$OUT`，或告訴使用者它在哪裡、裡面有未遮蔽的路徑資訊。

## 判斷準則

- `references/tools.md`：各工具的安裝指令、依版本區分的掃描指令、JSON 欄位怎麼摘要、各工具嚴重度對照 CRITICAL / HIGH / MEDIUM / LOW 的規則（Step 0–6 必讀）
- `references/review.md`：人工檢查的入口清單做法（依框架）、深讀順序、九類檢查項目（每項的找法、成立條件、預設嚴重度）、信心與證據的標準（Step 6.5 必讀）
- `references/report.md`：報告格式與範例、已排除段與掃描涵蓋表的寫法（Step 7 必讀）

## 常見失敗模式

| 症狀 | 為什麼是錯的 |
|---|---|
| Semgrep 沒裝，報告寫「未發現程式碼問題」 | 沒跑不等於乾淨（核心規則 5） |
| 把 Gitleaks 的 JSON 存在 repo 根目錄 | 報告裡就是 secrets，下一次 commit 就把它們推上去了（核心規則 2） |
| 報告裡寫 `AKIA...XYZ` 方便辨認 | 前後幾碼也是外流的一部分（核心規則 3） |
| 順手跑 `npm audit fix` | 會改 lockfile、可能升 major 弄壞程式；本 skill 只回報（核心規則 1） |
| 把 Semgrep 的 800 條原樣貼出來 | 沒有排除誤報與合併重複，使用者看不出哪 3 條要先修（Step 6） |
| 沒讀程式碼就標 HIGH SQL Injection | 掃描器對參數化查詢常誤報；沒確認的 HIGH 會讓人不再相信報告（核心規則 7） |
| 只掃工作目錄的 secrets | 已經刪掉但還在 git 歷史的 key 才是最常見的外流（Step 1） |
| 為了掃 image 自動 `docker build` | Dockerfile 可以執行任意指令（核心規則 10） |
| 把 exit code 1 當成工具執行失敗 | 那通常代表「有發現」（核心規則 6） |
| 沒列入口清單就開始挑檔案讀 | 漏掉的永遠是沒想到的那個 route（`references/review.md`） |
| 人工檢查只看了三個 route，報告寫「未發現授權問題」 | 沒深讀的入口不算檢查過；要寫「入口 N 個，深讀 M 個」（核心規則 5） |
| Semgrep 乾淨就跳過業務邏輯 | 前端算的金額、負數、race condition，掃描器一條都抓不到 |
