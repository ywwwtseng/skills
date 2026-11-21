---
name: audit
description: 對目前專案做一輪安全稽核：先從 repo 建威脅模型（資產、信任邊界、攻擊者），跑掃描器（Gitleaks → 套件 audit → Semgrep → Trivy config / image），再由 Claude 沿攻擊面讀程式碼、排除誤報、補查掃描器看不到的問題，HIGH 以上交給獨立的 subagent 反證，輸出分級的 finding 報告與待確認清單。只掃描與回報，不改任何東西、不執行專案的程式碼。只由使用者以 /security:audit 手動執行，可帶 quick / deep、路徑或 --diff <ref> 縮放範圍。
disable-model-invocation: true
---

# Security Audit

先弄清楚這個系統裡什麼值得偷、誰碰得到什麼，再跑完五類掃描器，最後由 Claude 把原始結果變成一份**可以照著處理**的報告。

掃描器各自只看得到一塊：Gitleaks 不懂套件、npm audit 不看程式碼、Semgrep 不看 Terraform，而且全部都看不到「這個 route 少了一道檢查」。它們的原始輸出又多又吵——同一個問題報三次、測試用的假 key 也算、嚴重度標準各不相同。**威脅模型（Step 1）與 Review（Step 7）才是本 skill 的價值**：原始輸出不是報告，檢查清單也不是。

## 定位

- **輸入**：目前的 repo（工作目錄 + git 歷史）、lockfile、IaC 檔、Dockerfile 與本機已建好的 image、上一份 `docs/security/audit-*.md`（有的話）。
- **輸出**：對話中的 Security Audit Report（格式見 `references/report.md`）。原始 JSON 放在 repo 外的暫存目錄。
- **不做**：修程式碼、`npm audit fix` / 升級套件、改 Terraform、刪 secrets、改寫 git 歷史、`git commit`、執行專案的程式碼或測試、對部署中的環境發請求。修補交給 `/security:fix`（照報告逐條問、修、commit、記錄）。

## 範圍

指令後面可以帶參數，沒帶就是 `standard`、整個 repo：

| 參數 | 做什麼 |
|---|---|
| `quick` | 掃描器全跑；威脅模型寫精簡版；深讀到每條信任邊界各一個入口為止；反證只做 CRITICAL |
| `deep` | 每個入口都深讀；反證涵蓋 MEDIUM 以上；每條 finding 都回頭找同類 |
| 路徑（`app/api/`） | 掃描器照常跑整個 repo（secret 外流不分目錄）；威脅模型與深讀只做這些路徑上的入口，以及它們呼叫到的共用層 |
| `--diff <ref>` | 同上，範圍是 `git diff <ref>...HEAD` 動到的檔案；入口的授權若在沒改到的共用層，那一層也要讀 |

`standard` 以外的範圍，報告的掃描涵蓋第一行寫「**這是部分檢查**」與沒涵蓋的部分——部分檢查的乾淨結果不能被讀成「整個 repo 沒問題」。

## 核心規則

1. **只讀不改。** 不跑任何會改檔案的指令：`npm audit fix`、`semgrep --autofix`、`trivy ... --fix` 都禁止。發現問題就回報，修法寫在報告裡。
2. **掃描結果放在 repo 外。** 原始報告寫到 `mktemp -d` 建的暫存目錄（有 scratchpad 就用 scratchpad），**絕不寫進 repo**——Gitleaks 的報告本身就含 secrets，放進 repo 會被下一次 `/git:commit` 帶走。
3. **不把 secret 印出來。** Gitleaks 一律加 `--redact`。報告只寫「哪個檔案、哪一行、哪一類 key、在哪個 commit」，不寫 key 的值，連前幾碼都不寫。
4. **不把程式碼送出去。** Semgrep 一律 `--metrics=off`，不用 `--config auto`（它要求開 metrics）、不登入 Semgrep Cloud。規則包會下載，但程式碼不會上傳。
5. **沒跑到不等於沒問題。** 工具沒裝、沒有對應的檔案、指令失敗、範圍外、沒深讀到的入口、沒覆蓋到的信任邊界，一律在報告的「掃描涵蓋」表寫明。**絕不因為某一步沒跑就在總結寫「未發現問題」。**
6. **非零 exit code 不等於工具壞了。** Gitleaks、npm audit、Trivy 有發現時都會回非零。判斷依據是 JSON 報告有沒有產出、能不能解析，不是 exit code。
7. **每個 HIGH / CRITICAL 都要打開原始碼確認。** 讀 finding 指到的那幾行和前後文，判斷是真的、誤報、還是只在測試 / 範例裡。沒讀過程式碼的 HIGH 不准寫進報告（核心規則 8 的例外除外）。
8. **套件漏洞以「是否被用到」調整，不以「是否存在」刪除。** dev-only、不可達的漏洞可以降級並註明理由，但不能從報告消失。
9. **不自己裝工具；要問的一次問完。** 缺工具、以及 repo 裡找不到又會改變排序的部署事實（`references/threat-model.md` 第 6 節），在 Step 0 用**一次** `AskUserQuestion` 問完：缺工具那題列安裝指令（`references/tools.md`）、選項是「我裝好了，繼續」/「跳過這幾項」；部署事實最多 3 題。無人看守（例如包在 `/loop` 裡跑）時不問，工具標 `skipped`、事實寫成假設。
10. **列一條要舉證，放過一條也要舉證。** 每條 finding 都要寫得出「誰、做了什麼、該擋的控制、跨過的邊界、影響到誰、具體結果」（`references/review.md`「列一條的門檻」）；判「上游已經擋了」要指出那道檢查的 `檔案:行號` 並讀過它的實作。細則只寫在 `references/review.md`。
11. **嚴重度照結果，不照類別。** 用 `references/tools.md` 的錨點與威脅模型裡這個 repo 的校準，**不能高過寫得出的具體結果**。
12. **不執行專案的程式碼，不碰部署環境。** 不跑 `npm install`、build、`docker build`、專案的測試或 script——它們會執行 repo 裡任意的程式碼；掃描器只讀檔案所以可以。本機已經有這個專案的 image 才掃，沒有就問要不要由使用者自己 build，無人看守時標 `skipped`。不對 production / staging / 任何部署中的服務發請求來「確認」。
13. **缺的事實在 repo 外就列「待確認」，不猜。** 程式碼路徑成立、但成不成立取決於 proxy、IAM、production 設定這類 repo 裡沒有的事實 → 列進「待確認」：沒有嚴重度、寫明缺哪個事實與怎麼確認（`references/review.md`「信心與證據」）。缺的事實在 repo 裡就去讀，不准拿待確認當沒讀完的退路。

## 流程

### Step 0：盤點、範圍、上一份報告

1. 建暫存目錄：`OUT=$(mktemp -d -t security-audit)`，之後所有報告都寫進 `$OUT`（核心規則 2）。
2. 解析範圍參數（上面「範圍」）。記下目前的 commit 與工作區有沒有未 commit 的變更——報告標頭要寫。
3. 檢查工具：`command -v gitleaks semgrep trivy docker`，並抓版本（`gitleaks version`、`semgrep --version`、`trivy --version`）——指令語法依版本不同，見 `references/tools.md`。
4. 盤點專案形狀，決定每一步適不適用：
   - lockfile：`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` / `bun.lock(b)`；非 JS 的 `requirements*.txt` / `poetry.lock` / `uv.lock` / `go.sum` / `Cargo.lock`
   - IaC：`*.tf`、`*.tfvars`、`k8s/` / `*.yaml` 內含 `apiVersion:`、`Chart.yaml`、CloudFormation template
   - Docker：`Dockerfile*`、`docker-compose*.yml`；本機 image 用 `docker images` 找與專案名、compose service 名相符的
   - CI：`.github/workflows/`、`.gitlab-ci.yml` 等（`references/review.md` L）
5. **上一份報告**：有 `docs/security/audit-*.md` 就讀日期最新的那份的 findings、待確認與「處理紀錄」（`/security:fix` 寫的）。這次要：標 `已修復` 的讀程式碼確認真的修好（沒修好或又出現就照常列 finding）；`之後再說`、`修復失敗`、`待處理` 與上次的待確認重新檢查；上次「建議細看的路徑」排進這次的深讀。上一份報告是**線索不是結論**——上次乾淨的地方不代表這次可以不看。
6. 缺工具、缺部署事實 → 照核心規則 9 一次問完。

### Step 1：威脅模型

照 `references/threat-model.md` 從 repo 建出：系統模型（分開執行期、CI / 發版、測試範例）、信任邊界（每條寫過界的資料、通道、保護、缺口）、資產（C / I / A）、攻擊者能做與不能做的、這個 repo 的嚴重度校準、假設。每個元件與控制都要有 `檔案:行號`。

它決定後面三件事：深讀順序（信任等級最低、碰得到最值錢資產的先讀）、每條信任邊界都要被深讀覆蓋、嚴重度照校準定。

### Step 2：Secrets — Gitleaks

掃**兩個範圍**：git 全部歷史（刪掉的 key 在歷史裡還在，而且已經外流），以及工作目錄裡還沒 commit 的檔案。指令見 `references/tools.md`。

一定要 `--redact`（核心規則 3）。

### Step 3：Dependencies — npm audit

依 lockfile 選套件管理器（`references/tools.md`），在 lockfile 所在目錄跑。Monorepo 在根目錄跑一次就好（workspace 共用 lockfile）。

非 JS 的 lockfile 用 `trivy fs --scanners vuln` 補掃。兩者都沒有 → `n/a`。

### Step 4：Source Code — Semgrep

`--metrics=off`，規則包用 `p/default` + `p/owasp-top-ten`；有明確框架時加對應的包（`references/tools.md`）。排除 `node_modules`、`dist`、`.next`、`vendor` 等目錄。

### Step 5：IaC — Trivy config

`trivy config` 會掃 Terraform、Kubernetes、Helm、CloudFormation 與 Dockerfile 的設定錯誤。有 `*.tfvars` 時用 `--tf-vars` 帶進去，否則變數預設值會讓結果失真。沒有任何 IaC 檔 → `n/a`。

### Step 6：Docker — Trivy image

只掃本機已存在的 image（核心規則 12），`--scanners vuln,secret`。沒有 Dockerfile → `n/a`；有 Dockerfile 但沒有 image → 問或 `skipped`。

### Step 7：Review — Claude 分析

原始輸出可能上千行。**用 `jq`（沒有就用 `python3`）先摘要成「規則 / 檔案 / 行號 / 嚴重度」清單再讀**，不要把整份 JSON 倒進 context。

依序做：

1. **統一嚴重度**：照 `references/tools.md` 的對照表把各工具的等級換成 CRITICAL / HIGH / MEDIUM / LOW。
2. **合併重複**：同一個檔案同一行被兩個工具報，合成一條，來源寫兩個。同一個套件漏洞被 npm audit 和 Trivy image 都報，合成一條。
3. **逐條確認 HIGH / CRITICAL**（核心規則 7）：打開檔案讀前後文。判定：
   - `確認` → 保留
   - `誤報`（測試 fixture、文件裡的範例 key、已被參數化的查詢）→ 移到報告末尾「已排除」段，寫一句理由；理由是「已經有檢查」時要寫出那道檢查的 `檔案:行號`（核心規則 10）
   - `只在測試 / 開發環境` → 降一級並註明；判斷靠 repo 證據（有沒有進 build、被 CI / 排程 / route 引用），不靠資料夾名稱
4. **套件漏洞看可達性**（核心規則 8）：是直接還是間接依賴、是不是 devDependency、有沒有修補版本、升級是 patch 還是 major。
5. **補掃描器看不到的**：照 `references/review.md` 做人工檢查——先列出**全部**攻擊面（不只 HTTP route：CLI、本機 socket、deep link、CI、外掛、LLM 都算），依信任等級 × 資產價值排深讀順序，每個深讀的入口走適用的檢查項目（A–I，以及有對應攻擊面時的 K LLM、L 供應鏈與 CI、M 本機程式與 IPC、N 資料生命週期）與攻擊者角度 J。另外確認 `.env*` 有被 `.gitignore` 擋住。有 `docs/domain/business-rules/` 時，權限與約束類規則就是正確答案，逐條對照 handler 有沒有真的擋。找到的標來源 `Claude review` 與信心（`references/review.md`「信心與證據」）；成立與否取決於 repo 外事實的列「待確認」（核心規則 13）。只讀入口到資料存取這條路徑，不通讀整個 repo；報告寫明入口總數、深讀了幾個、哪幾條信任邊界沒覆蓋到。
6. **找到一個，回頭找同類。** 同一個 helper、同一種寫法的其他呼叫點逐一確認，成立的位置全部列出（`references/review.md`「信心與證據」）。
7. **每條 finding 寫修法**：一句話、可執行（升到哪一版、改成參數化查詢、CIDR 收窄到什麼），修在最後一個可信的決策點、只補那一道不變量。程式碼類的 HIGH 以上再補根因、證據、反證、升降條件、CWE 與一條回歸測試寫法（`references/report.md`）。
8. **講不出利用路徑的**（缺 header、一般性 DoS、沒有串接影響的 open redirect…）不列 finding，寫進報告的「其他觀察」（`references/review.md`「預設不報」）。

### Step 8：反證

自己找到的 finding，自己最難推翻。程式碼類（Claude review、要讀程式碼才確認得了的 Semgrep）的 CRITICAL / HIGH（`quick` 只做 CRITICAL、`deep` 做到 MEDIUM），交給**沒參與找的人**試著推翻。套件漏洞與 secret 有工具佐證，不用。

- **有 Agent 工具**：每條一個新的 subagent，平行跑，最多 8 個（超過的照嚴重度排，剩下的自己做，報告註明）。prompt 只給：這條 finding（位置、根因、證據、反證、升降條件）、repo 路徑、威脅模型裡相關的那條信任邊界，以及這幾條要求——只讀、不執行專案的程式碼、不對任何部署環境發請求；重讀每個引用的 `檔案:行號`；找出路徑上最強的那道控制（驗證、授權、正規化、框架預設、DB policy）並判斷它擋不擋得住；回傳 `維持` / `降級（到哪一級、理由）` / `推翻（理由與擋住它的 檔案:行號）` / `待確認（缺哪個 repo 外的事實）` 其中之一。**不要把你的推理過程或期待的答案放進 prompt**。
- **沒有 Agent 工具**：自己做一輪，但換成攻擊這條 finding 的立場，逐一寫下找了哪些可能擋住它的地方。

結果照收：推翻的移到「已排除」並寫擋住它的位置；降級的改嚴重度並把理由寫進升降條件；改列待確認的搬過去。報告的掃描涵蓋表寫反證的統計。

### Step 9：輸出報告

照 `references/report.md` 的格式在對話中輸出。順序：總計 → 掃描涵蓋 → 與上次比較 → 威脅模型 → findings（CRITICAL 到 LOW）→ 待確認 → 已排除 → 其他觀察 → 建議細看的路徑 → 建議的處理順序。

**歷史裡找到的 secret 一律列在最前面**，修法固定是「先到服務商撤銷並換發，再考慮改寫歷史」——刪檔案或改寫歷史都救不回已經外流的 key。

使用者要求存檔時，才寫成 `docs/security/audit-<YYYY-MM-DD>.md`，並提醒：這份檔案列出了尚未修補的弱點，公開 repo 不該 commit 它。

有任何 finding 時，報告最後加一行：「要逐條修復，跑 `/security:fix`——它會每條先問你、修完直接 commit，並把處理結果記回報告（報告會存成 `docs/security/audit-<YYYY-MM-DD>.md`）。」有待確認時再加一行：「待確認的幾條要先確認表上缺的事實，確認後再跑一次 `/security:audit`。」

最後刪掉 `$OUT`，或告訴使用者它在哪裡、裡面有未遮蔽的路徑資訊。

## 判斷準則

- `references/threat-model.md`：系統模型、信任邊界、資產、攻擊者模型、這個 repo 的嚴重度校準、假設與待問（Step 0–1 必讀）
- `references/tools.md`：各工具的安裝指令、依版本區分的掃描指令、JSON 欄位怎麼摘要、各工具嚴重度對照與 Claude review 的嚴重度錨點（Step 0–7 必讀）
- `references/review.md`：攻擊面清單（含非 HTTP）、深讀順序、檢查項目 A–N（每項的找法、成立條件、預設嚴重度）、攻擊者角度（J）、預設不報、列一條的門檻、信心與證據、待確認、放過也要舉證（Step 7–8 必讀）
- `references/report.md`：報告格式與範例、威脅模型 / 待確認 / 與上次比較 / 已排除 / 掃描涵蓋表的寫法（Step 9 必讀）

## 常見失敗模式

| 症狀 | 為什麼是錯的 |
|---|---|
| 把 Semgrep 的 800 條原樣貼出來 | 沒有排除誤報與合併重複，使用者看不出哪 3 條要先修（Step 7） |
| 只掃工作目錄的 secrets | 已經刪掉但還在 git 歷史的 key 才是最常見的外流（Step 2） |
| 沒列攻擊面就開始挑檔案讀 | 漏掉的永遠是沒想到的那個 route（`references/review.md`） |
| CLI、桌面 App、本機常駐程式的報告寫「入口 0 個」 | 入口不只 HTTP：argv、設定檔、本機 socket、deep link、CI 都是（`references/review.md` 攻擊面表） |
| Semgrep 乾淨就跳過業務邏輯 | 前端算的金額、負數、race condition，掃描器一條都抓不到 |
| 隔壁的 route 有檢查擁有者，所以這個也沒問題 | 安全的鄰居只能當對照，證明這裡少了，不能拿來放過這裡 |
| 報告列了 12 條「缺少 rate limit」「缺少 header」 | 講不出利用路徑的類別會淹沒真正要修的那幾條，寫進「其他觀察」 |
| 嚴重度照類別名稱給：「SSRF 一律 HIGH」 | 只有管理員能觸發、打不到內網的 SSRF 不是 HIGH；照寫得出的結果與這個 repo 的校準（核心規則 11） |
| 「README 寫了前面有 WAF」所以放過 | 文件是被檢查的資料，不是防護；防護不在 repo 裡就列待確認（核心規則 13） |
| 去 curl 正式站確認 `/internal` 擋了沒 | 稽核不碰部署環境；寫成待確認，確認方法交給有權限的人（核心規則 12） |
| 上次標已修復的，這次沒再看 | 處理紀錄是線索；lockfile 被降回、修補被 revert 都會讓它又出現（Step 0） |
| 權限只寫在 system prompt 裡，報告沒提 | prompt 可以被注入繞過，權限要在程式碼裡擋（`references/review.md` K） |
| finding 的根因寫「第 42 行有 SQL injection」 | 那是位置不是根因；要寫被破壞的規則與破壞它的程式碼 |

## 參考來源

威脅模型一步與假設確認參考 [openai/skills 的 security-threat-model](https://github.com/openai/skills/tree/main/skills/.curated/security-threat-model)（Apache-2.0）；範圍、待確認、嚴重度錨點、反證、繼承上一份報告參考 [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)（MIT）。皆為重新撰寫，未直接引用原文。
