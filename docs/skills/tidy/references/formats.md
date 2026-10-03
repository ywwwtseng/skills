# 格式與指令（Step 0–1）

## 判斷 feature 是否已合併

```sh
BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD | sed 's@^origin/@@')   # 失敗就用 main
git fetch origin "$BASE" --quiet

# 最後一個改到這份 plan 的 commit 是否已在遠端 base 上
LAST=$(git log -1 --format=%H -- docs/impl/<feature>/plan.md)
git branch -r --contains "$LAST" | grep -q "origin/$BASE$" && echo merged
```

有 `backlog.md` 時以它為準：該列 `狀態` 是 `done`（`階段` `merged`）才算。backlog 說 `done` 但上面的指令判斷沒合併 → 兩邊不一致，跳過這個 feature 並寫進報告，不要猜哪邊對。

## 找 task 的 commit

`/impl:feature` 把程式碼與 plan.md 的狀態更新放在同一個 commit，message 帶 task ID。task ID 只在一個 feature 裡唯一，所以一定要限定在那份 plan：

```sh
git log --format='%h %s' -E --grep='T-003([^0-9]|$)' -- docs/impl/<feature>/plan.md
```

取**最新**那一個（標成 `done` 的那次）。有被 `/domain:feedback` 標回 `todo` 又重做過的，會有多個——一樣取最新。找不到寫 `—`。

## 收合後的 plan.md

只換 `## Tasks` 段裡狀態是 `done` 的 task；其他段落（執行協議、目標與範圍、上游狀態、執行序、規則覆蓋、上游回饋、變更紀錄）原樣保留。

```markdown
## Tasks

### 已完成（已收合）

> 這些 task 已隨 feature 合併進 base branch，只保留追溯所需的欄位；完整內容（動到、驗收、備註）在該 commit 的 plan.md 裡（`git show <commit>:docs/impl/<feature>/plan.md`）。
> 被 `/domain:feedback` 標回 `todo` 的列：`/impl:feature` 不要直接實作，先跑 `/impl:plan` 把它展開回完整的 task 段（動到 / 前置 / 驗收），再從表裡刪掉這一列。

| ID | 標題 | 來源 | commit | 狀態 | 備註 |
|---|---|---|---|---|---|
| T-001 | 建立訂單貫穿切片 | `order-dedup/BR-ORD-001`、`order.md#Order`、`schema.md#orders` | `a1b2c3d` | done | |
| T-002 | 重複下單判定 | `order-dedup/BR-ORD-003`、`order.md#POL-ORD-001` | `e4f5a6b` | done | |
| T-003 | 取消時間窗 | `order-dedup/BR-ORD-007` | — | done | 找不到 commit |

### T-009 <還沒做完的 task 照原樣留著>
...
```

- **來源**原樣搬過來，一個字都不改（核心規則 3）。
- **備註**欄只放 Step 1.1 判斷不出來的內容，以及「找不到 commit」這種收合本身的註記。
- 標頭的 `進度` 不變（`done` 數與總數都沒變）。
- 「變更紀錄」加一列：`<YYYY-MM-DD> /docs:tidy 收合 T-001–T-008（原文見 <收合前最後一個 commit>）`。

## 追加到 debt.md

格式跟 `/impl:refactor` 的 `docs/impl/debt.md` 一致，編號往後接：

```markdown
| D-014 | <類型，判斷不出來寫「未分類」> | `<檔案路徑，備註沒寫就留空>` | <備註原文，濃縮成一句> | <留空，由 /impl:refactor 評估> | <留空> | 待處理 | order-dedup T-004 備註 | |
| D-015 | 重複 | `src/domain/order.ts` | 退款期限計算重複兩處 | | | 待處理 | order-dedup verification finding #3 | |
```

追加前先搜 `debt.md` 的來源欄：同一個出處已經在裡面就不加。收益、測試保護留空——那是 `/impl:refactor` 的判斷，不是本 skill 的。

`debt.md` 不存在 → 照 `/impl:refactor` 的 debt.md 格式（標題、說明、表頭）建立。

## docs/archive/

```
docs/archive/
├── README.md
├── impl/
│   ├── <feature>/verification.md
│   └── debt.md                       # 已處理 / 已駁回的債，依日期追加
└── security/
    └── audit-<YYYY-MM-DD>.md
```

路徑跟原本的位置對應（`docs/impl/x/verification.md` → `docs/archive/impl/x/verification.md`），之後要找回來不用猜。一律 `git mv`。

例外：`docs/security/audit-*.md` 常常是刻意不 commit 的（`/security:audit` 提醒過公開 repo 不該 commit 它）。先用 `git ls-files --error-unmatch <檔案>` 確認——沒被追蹤的用一般的 `mv`，而且不要在這次 commit 裡把它加進去。

`docs/archive/README.md`：

```markdown
# Archive

這裡放已經結束的文件：已合併 feature 的驗收報告、已處理的技術債、舊的 audit 報告。
任何 skill 都不讀這個目錄；實作、規劃、稽核時不要把這裡的內容當作現況。
內容由 `/docs:tidy` 搬進來，路徑對應原本的位置。
```

搬 `debt.md` 的列時，先在 `docs/archive/impl/debt.md` 追加一個日期小標（`## <YYYY-MM-DD> 歸檔`）再貼表格，不要覆蓋之前歸檔的內容。
