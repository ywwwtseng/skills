# 偵測重複與過時（Step 2–3）

腳本寫到 scratchpad（沒有就 `mktemp -d`）再跑，不要寫進 repo。輸出是候選清單，不是結論：每一條都要打開檔案讀前後文才能判斷。

## 擁有者表

每一種內容只有一份文件擁有它。其他文件出現同樣的內容就是複本。

| 內容 | 擁有者 | 其他文件該怎麼寫 |
|---|---|---|
| 規則的條文、範例、例外 | `docs/domain/business-rules/<主題>.md` | `BR-ORD-004`，可加一行摘要 |
| 實體、值物件、不變量、Policy、狀態機 | `docs/domain/model/<聚合>.md`、`shared.md` | `order.md#Order.status`、`INV-ORD-002` |
| table、欄位、約束、索引、落點 | `docs/db/schema.md` | `schema.md#orders` |
| 端點、request / response、錯誤碼 | `docs/api/contract.md` | `contract.md#POST /orders/{id}/cancel`、錯誤碼名稱 |
| 畫面、狀態、畫面行為 | `docs/ui/screens/<畫面>.md` | 畫面檔名 |
| 技術選擇、指令、約束與慣例 | `docs/architecture/tech-stack.md`、`testing.md` | 「見 tech-stack.md 約束與慣例」 |
| task 的進度與備註 | 該 feature 的 `plan.md` | task ID |

## 刻意的重複（不動）

- `plan.md`、`backlog.md` 的「執行協議」段：`/impl:plan` 與 `/impl:ship` 規定原樣寫進每一份檔案。
- `plan.md` 規則覆蓋表的「規則摘要」欄：一行，給人掃讀用。
- `schema.md` 不變量落點表裡的不變量 ID 與名稱。
- `contract.md` 棄用表裡還沒到移除條件的舊端點。
- 引用 ID 後面接的一行摘要（`BR-ORD-004（出貨後不可取消）`）。
- `docs/archive/` 底下的一切——不掃。

## 重複行偵測

以「段落裡夠長的一行」為單位，找出現在兩份以上文件的。跳過標題含「執行協議」的段落、表頭與分隔列、程式碼區塊。

```python
# dup.py — python3 dup.py docs
import re, sys, pathlib, collections

MIN = 25  # 正規化後的最短字數；中文一句大約這麼長
root = pathlib.Path(sys.argv[1])
seen = collections.defaultdict(list)

def norm(s):
    s = re.sub(r'^[\s>*\-+|#\d.]+', '', s)        # 清單符號、引言、表格起頭、標題
    s = re.sub(r'[`*_|]', '', s)                    # 行內格式與表格欄位
    s = re.sub(r'^\s*(?:[\w-]+/)?[A-Z]{2,4}-[A-Za-z]+-\d+\s*', '', s)  # 行首的 ID（INV-ORD-001 ...）
    return re.sub(r'\s+', ' ', s).strip()

for p in sorted(root.rglob('*.md')):
    if 'archive' in p.parts:
        continue
    section, fence = '', False
    for i, line in enumerate(p.read_text(encoding='utf-8').splitlines(), 1):
        if line.startswith('```'):
            fence = not fence
            continue
        if fence:
            continue
        if line.startswith('#'):
            section = line
            continue
        if '執行協議' in section or re.match(r'^\s*\|[\s:|-]+\|\s*$', line):
            continue
        n = norm(line)
        if len(n) >= MIN:
            seen[n].append(f'{p}:{i}')

for text, locs in sorted(seen.items(), key=lambda kv: -len(kv[1])):
    if len({l.rsplit(':', 1)[0] for l in locs}) > 1:
        print(f'{len(locs)}x  {text[:80]}')
        for l in locs:
            print(f'      {l}')
```

讀結果的方式：

- 同一組裡**連續好幾行**都重複 → 整段被複製，優先處理。
- 只有一行重複、而且是一句通用的話（「沒有就寫無」）→ 不算，略過。
- 找原文：依擁有者表，其他位置都是複本。擁有者那份沒有這段，只有兩份下游文件互相重複 → 兩份都改成引用擁有者裡對應的 ID；擁有者裡找不到對應的內容 → 這是缺口不是重複，記進 Step 3。
- 複本跟原文只差標點、空白、清單符號 → 重複；用字、數字、條件有任何不同 → 分岔（SKILL 核心規則 5）。比對用 `diff <(sed -n 'A,Bp' 原文) <(sed -n 'C,Dp' 複本)`，不要憑眼睛。

## ID 與錨點的格式

| 種類 | 格式 | 定義在哪 |
|---|---|---|
| 規則 | `BR-ORD-004`、`<slug>/BR-ORD-004` | `business-rules/<slug>.md` 的 `#### BR-ORD-004` 標題 |
| 不變量 / Policy | `INV-ORD-002`、`POL-ORD-001` | `domain/model/*.md` |
| 模型元素 | `order.md#Order.status`、`shared.md#Money` | `domain/model/order.md` 裡的元素名 |
| table | `schema.md#orders` | `db/schema.md` 的 table 標題 |
| 端點 | `contract.md#POST /orders/{id}/cancel` | `api/contract.md` 的端點清單 |
| task / 回饋 / 債 | `T-003`、`F-002`、`D-014` | 各自的 `plan.md` / `debt.md`，只在同一份檔案內有意義，不跨檔檢查 |

專案用了不同的前綴時（例如 `BR-order-012`），先 `grep -ohE '\b[A-Z]{2,4}-[A-Za-z]+-[0-9]{3}\b' -r docs | sort | uniq -c` 看實際用了哪些，再調整下面的正規表示式。

## 懸空引用

```python
# refs.py — python3 refs.py docs
import re, sys, pathlib

root = pathlib.Path(sys.argv[1])
files = [p for p in root.rglob('*.md') if 'archive' not in p.parts]
text = {p: p.read_text(encoding='utf-8') for p in files}

def owners(sub):
    return '\n'.join(t for p, t in text.items() if sub in str(p))

br, model = owners('domain/business-rules'), owners('domain/model')
defined_br = set(re.findall(r'^#+\s*(BR-[A-Za-z]+-\d+)', br, re.M))
defined_model = set(re.findall(r'\b((?:INV|POL)-[A-Za-z]+-\d+)\b', model))

anchor = re.compile(r'([\w-]+\.md)#((?:GET|POST|PUT|PATCH|DELETE) [^\s`|）)]+|[^\s`|，、）)]+)')
by_name = {}
for p in files:
    by_name.setdefault(p.name, []).append(p)

for p, t in text.items():
    for i, line in enumerate(t.splitlines(), 1):
        for m in re.finditer(r'\b(BR-[A-Za-z]+-\d+)\b', line):
            if m[1] not in defined_br:
                print(f'{p}:{i}  {m[1]}  規則不存在')
        for m in re.finditer(r'\b((?:INV|POL)-[A-Za-z]+-\d+)\b', line):
            if m[1] not in defined_model and 'domain/model' not in str(p):
                print(f'{p}:{i}  {m[1]}  模型裡找不到')
        for m in anchor.finditer(line):
            name, frag = m[1], m[2]
            targets = by_name.get(name)
            if not targets:
                print(f'{p}:{i}  {name}#{frag}  檔案不存在')
            elif not any(frag.split('.')[-1] in text[x] for x in targets):
                print(f'{p}:{i}  {name}#{frag}  錨點找不到')
```

錨點檢查只看元素名是否出現在目標檔案裡，會漏報（名字出現在別的段落）但很少誤報；`錨點找不到` 的每一條都要打開目標檔案確認。

## 孤兒元素

- **模型**：`domain/model/*.md` 每個元素的「來源」欄列出的 BR，全部都在懸空清單裡 → 孤兒。
- **schema**：`schema.md` 每個 table / 欄位的追溯欄指到的模型元素，在懸空清單裡 → 孤兒。
- **畫面**：`ui/screens/*.md` 用到的端點不在 `contract.md` → 孤兒。
- **規則文件**：整份 `business-rules/<slug>.md` 沒有被模型 README 的「來源規則文件」列出，也沒有任何 backlog 列或 plan 引用 → 可能是廢棄的主題，也可能是還沒開始做的。只列出來，在問題裡把兩種可能都寫上。

## 找證據

```sh
git log -S 'BR-ORD-009' --oneline -- docs/          # 這個 ID 什麼時候出現、什麼時候消失
git log -1 --format='%h %ad %s' --date=short -- <檔案>   # 這份文件最後一次被改
```

問題裡寫「`BR-ORD-009` 在 `a1b2c3d`（2026-08-12，refactor(rules): 合併退款規則）從 `refund.md` 移除，`plan.md:42` 和 `schema.md:118` 還在引用」，讓使用者不用自己去翻就能決定。
