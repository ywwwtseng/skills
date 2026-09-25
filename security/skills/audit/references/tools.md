# 掃描工具

所有輸出都寫到 `$OUT`（repo 外的暫存目錄，SKILL 核心規則 2）。指令語法依版本不同，Step 0 抓到的版本決定用哪一行；不確定時先跑 `<tool> --help`。

## 安裝

缺工具時把對應指令一次列給使用者（SKILL 核心規則 9），不要自己跑。

| 工具 | macOS | 其他 |
|---|---|---|
| Gitleaks | `brew install gitleaks` | GitHub releases 的 binary |
| Semgrep | `brew install semgrep` | `pipx install semgrep` |
| Trivy | `brew install trivy` | 官方 install script 或 apt / yum repo |

Trivy 第一次執行會下載漏洞資料庫（需要網路，約一兩分鐘）。之後會用快取。

## 1. Gitleaks

| 範圍 | 8.19 以後 | 8.19 以前 |
|---|---|---|
| git 全部歷史 | `gitleaks git . --redact --report-format json --report-path $OUT/gitleaks-history.json` | `gitleaks detect --source . --redact --report-format json --report-path $OUT/gitleaks-history.json` |
| 工作目錄（含未 commit） | `gitleaks dir . --redact --report-format json --report-path $OUT/gitleaks-dir.json` | `gitleaks detect --source . --no-git --redact --report-format json --report-path $OUT/gitleaks-dir.json` |

有發現時 exit code 是 1（SKILL 核心規則 6）。repo 有 `.gitleaks.toml` 就沿用，不要另外指定設定。

`dir` 模式會掃到 `node_modules`，結果很吵；摘要時先濾掉 `node_modules/`、`.git/`、`dist/`。

摘要（只取這幾個欄位，**不取 `Secret`、`Match`**，即使已 redact）：

```sh
jq -r '.[] | [.RuleID, .File, .StartLine, (.Commit // "" | .[0:8]), .Date] | @tsv' $OUT/gitleaks-history.json
```

## 2. Dependencies

依 lockfile 選：

| lockfile | 指令 |
|---|---|
| `package-lock.json` | `npm audit --json > $OUT/deps.json` |
| `pnpm-lock.yaml` | `pnpm audit --json > $OUT/deps.json` |
| `yarn.lock`（Yarn 1） | `yarn audit --json > $OUT/deps.ndjson`（每行一個 JSON） |
| `yarn.lock`（Yarn 2+） | `yarn npm audit --all --recursive --json > $OUT/deps.ndjson` |
| `bun.lock` / `bun.lockb` | `bun audit --json > $OUT/deps.json`（需要 Bun 1.2.15 以上；更舊的版本改用 Trivy fs） |
| Python / Go / Rust 的 lockfile | `trivy fs --scanners vuln --format json --output $OUT/deps-trivy.json .` |

摘要：

```sh
# npm
jq -r '.vulnerabilities | to_entries[] | [.key, .value.severity, .value.isDirect, (.value.fixAvailable | if type=="object" then .version else tostring end)] | @tsv' $OUT/deps.json
# pnpm
jq -r '.advisories[] | [.module_name, .severity, .title, .patched_versions] | @tsv' $OUT/deps.json
# trivy fs
jq -r '.Results[]? | .Target as $t | .Vulnerabilities[]? | [$t, .PkgName, .InstalledVersion, .FixedVersion, .Severity, .VulnerabilityID] | @tsv' $OUT/deps-trivy.json
```

判斷是不是 devDependency：npm 的結果沒有這個欄位，用 `npm ls <pkg> --omit=dev` 查——沒輸出就代表只在 dev 依賴樹裡。

## 3. Semgrep

```sh
semgrep scan --metrics=off \
  --config p/default --config p/owasp-top-ten [--config <框架包>] \
  --exclude node_modules --exclude dist --exclude .next --exclude build --exclude vendor \
  --json --output $OUT/semgrep.json .
```

不要用 `--config auto`：它要求開啟 metrics（SKILL 核心規則 4）。

框架包依專案加：`p/typescript`、`p/react`、`p/nodejs`、`p/python`、`p/django`、`p/flask`、`p/golang`。某個包名不存在時 Semgrep 會報錯，拿掉那一個重跑即可。

摘要：

```sh
jq -r '.results[] | [.extra.severity, .check_id, .path, .start.line, (.extra.message | .[0:120])] | @tsv' $OUT/semgrep.json
jq -r '.errors[]? | .message' $OUT/semgrep.json   # 解析失敗的檔案，寫進掃描涵蓋表
```

## 4. IaC — Trivy config

```sh
trivy config --format json --output $OUT/iac.json [--tf-vars terraform/prod.tfvars] .
```

有多份 `*.tfvars`（dev / prod）時，**以 production 那份為準**——開發環境的寬鬆設定不是重點。判斷不出哪份是 production 就各跑一次。

摘要：

```sh
jq -r '.Results[]? | .Target as $t | .Misconfigurations[]? | [.Severity, .ID, $t, (.CauseMetadata.StartLine // ""), .Title, .Resolution] | @tsv' $OUT/iac.json
```

## 5. Docker — Trivy image

```sh
docker images --format '{{.Repository}}:{{.Tag}}'     # 找這個專案的 image
trivy image --scanners vuln,secret --format json --output $OUT/image.json <image>:<tag>
```

摘要同 Trivy fs。基底 image 的漏洞（`Target` 是 OS 套件）與應用程式依賴的漏洞分開列：前者的修法通常是換基底 image 版本。

## 嚴重度對照

| 來源 | CRITICAL | HIGH | MEDIUM | LOW |
|---|---|---|---|---|
| Gitleaks | 在 git 歷史或已追蹤檔案裡的雲端 / 金流 / 資料庫憑證、私鑰 | 在 git 歷史或已追蹤檔案裡的其他 key | 只在未追蹤且已被 gitignore 擋住的檔案（還沒外流） | — |
| npm / pnpm / yarn / bun audit | `critical` | `high` | `moderate` | `low`、`info` |
| Semgrep | 規則標 `CRITICAL`，或 `ERROR` 且 metadata 的 impact 與 likelihood 都是 HIGH，並經確認 | `ERROR`、規則標 `HIGH` | `WARNING`、規則標 `MEDIUM` | `INFO`、規則標 `LOW` |
| Trivy（fs / config / image） | `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`、`UNKNOWN`（註明是 UNKNOWN） |
| Claude review | 不給（沒有工具佐證的 finding 最高 HIGH） | 信心 `高` 且可被利用 | 信心 `中`，或需要特定條件 | 防禦縱深建議 |

調整規則（每次調整都要在 finding 寫理由）：

- 只在 devDependency / 測試 / 範例程式碼 → 降一級，最低 LOW
- 套件漏洞的受影響函式確定沒被呼叫 → 降一級
- IaC 設定只出現在明確的開發環境 → 降一級
- 對外開放（`0.0.0.0/0`）的資源是資料庫、SSH、管理介面 → 至少 HIGH
